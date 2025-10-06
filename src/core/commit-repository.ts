import type { Commit, CommitComparison, Range } from "./types.js"
import { GitError, GitErrorType } from "./errors.js"
import type { GitAdapter } from "../infrastructure/git-adapter.js"

export interface CommitRepository {
  getCurrentBranch(): Promise<string>
  getCommitRange(from: string, to: string): Promise<Commit[]>
  getUnpushedCommits(): Promise<Commit[]>
  getAheadBehindCommitCount(
    localRef?: string,
    remoteRef?: string
  ): Promise<CommitComparison>
  parseCommitRange(range: string, commits: Commit[]): Range
  cherryPickWithoutCommit(commit: Commit): Promise<void>
  commitWithMessage(message: string): Promise<void>
  createBranchFromOrigin(
    branchName: string,
    originBranch: string
  ): Promise<void>
  getNewCommitHash(): Promise<string>
}

export class GitCommitRepository implements CommitRepository {
  constructor(private gitAdapter: GitAdapter) {}

  async getCurrentBranch(): Promise<string> {
    return await this.gitAdapter.getCurrentBranch()
  }

  async getCommitRange(from: string, to: string): Promise<Commit[]> {
    return await this.gitAdapter.getCommitRange(from, to)
  }

  async getUnpushedCommits(): Promise<Commit[]> {
    const currentBranch = await this.getCurrentBranch()

    if (currentBranch === "HEAD") {
      throw new GitError(GitErrorType.DETACHED_HEAD, {
        operation: "get_unpushed_commits",
      })
    }

    const originBranch = `origin/${currentBranch}`

    try {
      await this.gitAdapter.revparse(["--verify", originBranch])
    } catch {
      throw new GitError(GitErrorType.ORIGIN_NOT_FOUND, {
        branch: currentBranch,
        originBranch,
      })
    }

    return await this.gitAdapter.getCommitRange(originBranch, "HEAD")
  }

  async getAheadBehindCommitCount(
    localRef?: string,
    remoteRef?: string
  ): Promise<CommitComparison> {
    localRef = localRef ?? (await this.getCurrentBranch())
    remoteRef = remoteRef ?? `origin/${localRef}`
    try {
      const command = [
        "rev-list",
        "--left-right",
        "--count",
        `${localRef}...${remoteRef}`,
      ]
      const result = await this.gitAdapter.raw(command)

      const trimmed = result.trim()
      const parts = trimmed.split("\t")

      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new GitError(GitErrorType.INVALID_COMMIT_RANGE, {
          command: command.join(" "),
          output: result,
          localRef,
          remoteRef,
        })
      }
      const ahead = parseInt(parts[0], 10)
      const behind = parseInt(parts[1], 10)

      if (isNaN(ahead) || isNaN(behind)) {
        throw new GitError(GitErrorType.INVALID_GIT_OUTPUT, {
          command: command.join(" "),
          output: result,
          parsedAhead: parts[0],
          parsedBehind: parts[1],
          localRef,
          remoteRef,
        })
      }

      return {
        ahead,
        behind,
        isAhead: ahead > 0,
        isBehind: behind > 0,
        isUpToDate: ahead === 0 && behind === 0,
      }
    } catch (error) {
      if (error instanceof GitError) {
        throw error
      }

      if (
        error instanceof Error &&
        error.message.includes("unknown revision")
      ) {
        throw new GitError(GitErrorType.BRANCH_NOT_FOUND, {
          localRef,
          remoteRef,
          originalError: error,
        })
      }
      throw new GitError(GitErrorType.BRANCH_COMPARISON_FAILED, {
        localRef,
        remoteRef,
        originalError: error,
      })
    }
  }

  parseCommitRange(range: string, commits: Commit[]): Range {
    if (range.includes("..")) {
      const [startStr, endStr] = range.split("..")
      const start = parseInt(startStr ?? "", 10) - 1
      const end = parseInt(endStr ?? "", 10) - 1

      if (start < 0 || end >= commits.length || start > end) {
        throw new Error(`Invalid range: ${range}`)
      }
      return {
        from: start,
        to: end,
        commits: commits.slice(start, end + 1),
      }
    } else {
      const index = parseInt(range, 10) - 1
      if (index < 0 || index >= commits.length || !commits[index]) {
        throw new Error(`Invalid commit index: ${range}`)
      }
      return {
        from: index,
        to: index,
        commits: [commits[index]],
      }
    }
  }

  async cherryPickWithoutCommit(commit: Commit): Promise<void> {
    await this.gitAdapter.cherryPick(commit.hash, true)
  }

  async commitWithMessage(message: string): Promise<void> {
    await this.gitAdapter.commit(message)
  }

  async createBranchFromOrigin(
    branchName: string,
    originBranch: string
  ): Promise<void> {
    await this.gitAdapter.checkoutBranch(branchName, originBranch)
  }

  async getNewCommitHash(): Promise<string> {
    return await this.gitAdapter.revparse(["HEAD"])
  }
}
