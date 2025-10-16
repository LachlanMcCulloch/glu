import { CommitService } from "../services/commit-service.js"
import type { IndexedCommit } from "../core/types.js"
import { GitAdapter } from "../infrastructure/git-adapter.js"
import { GluGraphService } from "../services/glu-graph-service.js"
import { FileSystemGraphStorage } from "../infrastructure/graph-storage-adapter.js"
import { extractGluId } from "../utils/glu-id.js"

export class ListUseCase {
  constructor(
    private commitService: CommitService,
    private gluGraphService: GluGraphService
  ) {}

  static default(): ListUseCase {
    const git = new GitAdapter()
    const graphStorage = new FileSystemGraphStorage()
    const commitService = new CommitService(git)
    const gluGraphService = new GluGraphService(graphStorage)
    return new ListUseCase(commitService, gluGraphService)
  }

  async execute(): Promise<ListResult> {
    const currentBranch = await this.commitService.getCurrentBranch()
    const upstreamBranch =
      await this.commitService.getUpstreamBranch(currentBranch)
    const unpushedCommits = await this.commitService.getUnpushedCommits()
    const comparison = await this.commitService.getAheadBehindStatus()

    const enrichedCommits =
      await this.enrichCommitsWithBranches(unpushedCommits)

    return {
      ahead: comparison.ahead,
      behind: comparison.behind,
      currentBranch,
      originBranch: upstreamBranch,
      unpushedCommits: enrichedCommits,
    }
  }

  private async enrichCommitsWithBranches(
    commits: IndexedCommit[]
  ): Promise<IndexedCommit[]> {
    return Promise.all(
      commits.map(async (commit) => {
        const gluId = extractGluId(commit.body)
        if (!gluId) {
          return { ...commit, trackedBranches: [] }
        }
        const branches = await this.gluGraphService.getBranchesForGluId(gluId)

        const currentBranch = await this.commitService.getCurrentBranch()
        const reviewBranches = branches
          .filter((b) => b.branch !== currentBranch)
          .map((b) => b.branch)

        return {
          ...commit,
          trackedBranches: reviewBranches,
        }
      })
    )
  }
}

export type ListResult = {
  ahead: number
  behind: number
  currentBranch: string
  originBranch: string
  unpushedCommits: IndexedCommit[]
}
