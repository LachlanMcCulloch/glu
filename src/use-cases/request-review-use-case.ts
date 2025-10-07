import type { Commit } from "../core/types.js"
import { GitAdapter } from "../infrastructure/git-adapter.js"
import { BranchService } from "../services/branch-service.js"
import { CherryPickService } from "../services/cherry-pick-service.js"
import { CommitService } from "../services/commit-service.js"

export class RequestReviewUseCase {
  constructor(
    private commitService: CommitService,
    private branchService: BranchService,
    private cherryPickService: CherryPickService
  ) {}

  static default(): RequestReviewUseCase {
    const git = new GitAdapter()
    const commitService = new CommitService(git)
    const branchService = new BranchService(git)
    const cherryPickService = new CherryPickService(git)
    return new RequestReviewUseCase(
      commitService,
      branchService,
      cherryPickService
    )
  }

  async execute(range: string): Promise<RequestReviewResult> {
    await this.commitService.requireCleanWorkingDirectory()
    const originalBranch = await this.branchService.getCurrentBranch()
    const commitsToReview = await this.commitService.getCommitsInRange(range)
    console.debug("commits to review", commitsToReview)

    const tempBranch = await this.branchService.createTempBranch("review")
    console.log("current", await this.commitService.getCurrentBranch())

    try {
      await this.cherryPickService.stageCommits(commitsToReview, tempBranch)

      const reviewBranch = "FOOBAR-TODO-CHANGEME"
      await this.branchService.createBranchFrom(reviewBranch, tempBranch)
      console.debug("created branch")

      // TODO: Support all kinds of remotes
      await this.branchService.push(reviewBranch, "origin")

      console.debug("about to delete branch")
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
