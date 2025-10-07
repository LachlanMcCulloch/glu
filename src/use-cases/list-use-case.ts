import { CommitService } from "../services/commit-service.js"
import type { IndexedCommit } from "../core/types.js"
import { GitAdapter } from "../infrastructure/git-adapter.js"

export class ListUseCase {
  constructor(private commitService: CommitService) {}

  static default(): ListUseCase {
    const git = new GitAdapter()
    const commitService = new CommitService(git)
    return new ListUseCase(commitService)
  }

  async execute(): Promise<ListResult> {
    const currentBranch = await this.commitService.getCurrentBranch()
    const upstreamBranch =
      await this.commitService.getUpstreamBranch(currentBranch)
    const unpushedCommits = await this.commitService.getUnpushedCommits()
    const comparison = await this.commitService.getAheadBehindStatus()

    return {
      ahead: comparison.ahead,
      behind: comparison.behind,
      currentBranch,
      originBranch: upstreamBranch,
      unpushedCommits,
    }
  }
}

export type ListResult = {
  ahead: number
  behind: number
  currentBranch: string
  originBranch: string
  unpushedCommits: IndexedCommit[]
}
