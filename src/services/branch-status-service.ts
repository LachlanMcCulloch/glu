import type { CommitRepository } from "@/core/commit-repository.js"
import type { Commit, CommitComparison } from "@/core/types.js"

export interface BranchStatus {
  localBranch: string
  remoteBranch: string
  unpushedCommits: Commit[]
  comparison: CommitComparison
  needsPush: boolean
  needsPull: boolean
  canFastForward: boolean
  hasUnpushedChanges: boolean
}

export class BranchStatusService {
  constructor(private commitRepo: CommitRepository) {}

  async getCurrentBranchStatus(): Promise<BranchStatus> {
    const localBranch = await this.commitRepo.getCurrentBranch()
    const remoteBranch = `origin/${localBranch}`

    const [unpushedCommits, comparison] = await Promise.all([
      this.commitRepo.getUnpushedCommits(),
      this.commitRepo.getAheadBehindCommitCount(localBranch, remoteBranch),
    ])

    return {
      localBranch,
      remoteBranch,
      unpushedCommits,
      comparison,
      needsPush: comparison.isAhead,
      needsPull: comparison.isBehind,
      canFastForward: comparison.isBehind && !comparison.isAhead,
      hasUnpushedChanges: unpushedCommits.length > 0,
    }
  }
}
