import { BranchNamingService } from "../services/branch-naming-service.js"
import type { Commit } from "../core/types.js"
import { GitAdapter } from "../infrastructure/git-adapter.js"
import { BranchService } from "../services/branch-service.js"
import { CherryPickService } from "../services/cherry-pick-service.js"
import { CommitService } from "../services/commit-service.js"
import { loadConfig } from "../config/index.js"

export interface RequestReviewOptions {
  branch?: string
  push?: boolean
}
export interface RequestReviewProgress {
  onValidatingWorkingDirectory?: () => void
  onValidatingRange?: () => void
  onCreatingStagingBranch?: () => void
  onCherryPicking?: (current: number, total: number, commit: Commit) => void
  onCreatingReviewBranch?: (branchName: string) => void
  onPushingBranch?: (branchName: string) => void
  onCleaningUp?: () => void
}

export class RequestReviewUseCase {
  constructor(
    private commitService: CommitService,
    private branchService: BranchService,
    private branchNamingService: BranchNamingService,
    private cherryPickService: CherryPickService
  ) {}

  static default(): RequestReviewUseCase {
    const config = loadConfig()
    const git = new GitAdapter()
    const commitService = new CommitService(git)
    const branchService = new BranchService(git)
    const branchNamingService = new BranchNamingService(config)
    const cherryPickService = new CherryPickService(git)
    return new RequestReviewUseCase(
      commitService,
      branchService,
      branchNamingService,
      cherryPickService
    )
  }

  async execute(
    range: string,
    options: RequestReviewOptions = {},
    progress?: RequestReviewProgress
  ): Promise<RequestReviewResult> {
    progress?.onValidatingWorkingDirectory?.()
    await this.commitService.requireCleanWorkingDirectory()

    progress?.onValidatingRange?.()
    const commitsToReview = await this.commitService.getCommitsInRange(range)

    const originalBranch = await this.branchService.getCurrentBranch()

    progress?.onCreatingStagingBranch?.()
    const tempBranch = await this.branchService.createTempBranch("review")
    try {
      await this.cherryPickService.stageCommits(commitsToReview, tempBranch)

      const reviewBranch = this.branchNamingService.generate(commitsToReview, {
        customName: options.branch,
        range,
      })
      progress?.onCreatingReviewBranch?.(reviewBranch)
      await this.branchService.createBranchFrom(reviewBranch, tempBranch, true)

      if (options?.push !== false) {
        progress?.onPushingBranch?.(reviewBranch)
        // TODO: Support all kinds of remotes
        await this.branchService.push(reviewBranch, "origin", true)
      }

      progress?.onCleaningUp?.()
      await this.branchService.deleteBranch(tempBranch)

      return {
        success: true,
        branch: reviewBranch,
        commits: commitsToReview,
      }
    } catch (error) {
      await this.cherryPickService.abortCherryPick().catch(() => {})
      const current = await this.branchService.getCurrentBranch()
      if (current.name === tempBranch) {
        await this.branchService.checkout(originalBranch.name).catch(() => {})
      }
      await this.branchService.deleteBranch(tempBranch).catch(() => {})
      throw error
    }
  }
}

export type RequestReviewResult = {
  success: boolean
  branch: string
  commits: Commit[]
}
