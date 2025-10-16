import { BranchNamingService } from "../services/branch-naming-service.js"
import type { Commit } from "../core/types.js"
import { GitAdapter } from "../infrastructure/git-adapter.js"
import { BranchService } from "../services/branch-service.js"
import { CherryPickService } from "../services/cherry-pick-service.js"
import { CommitService } from "../services/commit-service.js"
import { loadConfig } from "../config/index.js"
import { GluIdService } from "../services/glu-id-service.js"
import { GluGraphService } from "../services/glu-graph-service.js"
import { FileSystemGraphStorage } from "../infrastructure/graph-storage-adapter.js"
import { extractGluId } from "../utils/glu-id.js"

export interface RequestReviewOptions {
  branch?: string
  push?: boolean
}
export interface RequestReviewProgress {
  onValidatingWorkingDirectory?: () => void
  onValidatingRange?: () => void
  onInjectingGluIds?: (
    commitsProcessed: number,
    commitsModified: number
  ) => void
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
    private cherryPickService: CherryPickService,
    private gluIdService: GluIdService,
    private gluGraphService: GluGraphService
  ) {}

  static default(): RequestReviewUseCase {
    const config = loadConfig()
    const git = new GitAdapter()
    const graphStorage = new FileSystemGraphStorage()
    const commitService = new CommitService(git)
    const branchService = new BranchService(git)
    const branchNamingService = new BranchNamingService(config)
    const cherryPickService = new CherryPickService(git)
    const gluIdService = new GluIdService(git)
    const gluGraphService = new GluGraphService(graphStorage)
    return new RequestReviewUseCase(
      commitService,
      branchService,
      branchNamingService,
      cherryPickService,
      gluIdService,
      gluGraphService
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
    let commitsToReview = await this.commitService.getCommitsInRange(range)

    const originalBranch = await this.branchService.getCurrentBranch()

    // inject glu ids
    const unpushedCommits = await this.commitService.getUnpushedCommits()
    const injectionResult =
      await this.gluIdService.ensureCommitsHaveGluIds(unpushedCommits)
    progress?.onInjectingGluIds?.(
      injectionResult.commitsProcessed,
      injectionResult.commitsModified
    )

    // TODO: optimisation available here to skip if injected glu ids does not match range
    if (injectionResult.commitsModified > 0) {
      // hashes changed, re-fetch commits
      commitsToReview = await this.commitService.getCommitsInRange(range)
    }

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

      for (const commit of commitsToReview) {
        const gluId = extractGluId(commit.body)
        if (gluId) {
          await this.gluGraphService.recordCommitLocation(
            gluId,
            reviewBranch,
            commit.hash
          )
        }
      }

      let pullRequestUrl: string | undefined

      if (options?.push !== false) {
        progress?.onPushingBranch?.(reviewBranch)
        // TODO: Support all kinds of remotes
        const pushResult = await this.branchService.push(
          reviewBranch,
          "origin",
          true
        )
        pullRequestUrl = pushResult.pullRequestUrl

        // TODO: Support all kinds of remotes
        await this.gluGraphService.markBranchPushed(reviewBranch, "origin")
      }

      progress?.onCleaningUp?.()
      await this.branchService.deleteBranch(tempBranch)

      return {
        success: true,
        branch: reviewBranch,
        commits: commitsToReview,
        pullRequestUrl,
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
  pullRequestUrl?: string
}
