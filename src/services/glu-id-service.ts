import type { Commit } from "../core/types.js"
import type { GitAdapter } from "../infrastructure/git-adapter.js"
import { addGluIdToMessage, extractGluId, hasGluId } from "../utils/glu-id.js"

export interface GluIdInjectionResult {
  commitsProcessed: number
  commitsModified: number
}

export class GluIdService {
  constructor(private git: GitAdapter) {}

  async ensureCommitsHaveGluIds(
    commits: Commit[]
  ): Promise<GluIdInjectionResult> {
    if (commits.length === 0) {
      return {
        commitsProcessed: 0,
        commitsModified: 0,
      }
    }

    const commitsNeedingGluIds = commits.filter(
      (commit) => !hasGluId(commit.body)
    )

    if (commitsNeedingGluIds.length === 0) {
      return {
        commitsProcessed: commits.length,
        commitsModified: 0,
      }
    }

    await this.injectGluIds(commits)

    return {
      commitsProcessed: commits.length,
      commitsModified: commitsNeedingGluIds.length,
    }
  }

  async getGluId(commitHash: string): Promise<string | null> {
    try {
      const body = await this.git.raw(["log", "-1", "--pretty=%B", commitHash])
      return extractGluId(body)
    } catch {
      return null
    }
  }

  async hasGluId(commitHash: string): Promise<boolean> {
    const gluId = await this.getGluId(commitHash)
    return gluId !== null
  }

  async injectGluIds(commits: Commit[]): Promise<void> {
    const currentBranch = await this.git.getCurrentBranch()
    const oldestCommit = commits[0]!
    const baseCommit = await this.git.revparse([`${oldestCommit.hash}^`])

    const tmpBranch = "glu/tmp/add-glu-ids"
    await this.git.createBranchFrom(tmpBranch, baseCommit.trim(), true)
    await this.git.checkout(tmpBranch)

    try {
      for (let i = 0; i < commits.length; i++) {
        const commit = commits[i]!

        await this.git.cherryPick(commit.hash)

        const message = commit.body ?? ""

        if (!hasGluId(message)) {
          const newMessage = addGluIdToMessage(message)
          await this.git.raw([
            "commit",
            "--amend",
            "--no-edit",
            "-m",
            newMessage,
          ])
        }
      }

      const newHead = await this.git.revparse(["HEAD"])
      await this.git.raw([
        "update-ref",
        `refs/heads/${currentBranch}`,
        newHead.trim(),
      ])

      await this.git.checkout(currentBranch)
      await this.git.deleteLocalBranch(tmpBranch, true)
    } catch (error) {
      await this.git.checkout(currentBranch).catch(() => {})
      await this.git.deleteLocalBranch(tmpBranch, true).catch(() => {})
      throw error
    }
  }
}
