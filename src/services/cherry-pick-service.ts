import { GitError, GitErrorType } from "../core/errors/git-error.js"
import { ValidationError } from "../core/errors/validation-error.js"
import type { Commit, IndexedCommit } from "../core/types.js"
import { GitAdapter } from "../infrastructure/git-adapter.js"

export class CherryPickService {
  constructor(private git: GitAdapter) {}

  static default(): CherryPickService {
    const git = new GitAdapter()
    return new CherryPickService(git)
  }

  async cherryPickCommits(commits: Commit[], targetBranch: string) {
    if (commits.length === 0) {
      throw new ValidationError("No commits to cherry-pick", {
        targetBranch,
      })
    }

    await this.ensureOnBranch(targetBranch)

    for (const [index, commit] of commits.entries()) {
      try {
        await this.git.cherryPick(commit.hash)
      } catch (error) {
        await this.handleCherryPickError(error, commit, index, commits.length)
      }
    }
  }

  async stageCommits(commits: Commit[], stagingBranch: string): Promise<void> {
    const originalBranch = await this.git.getCurrentBranch()

    try {
      await this.cherryPickCommits(commits, stagingBranch)
      await this.git.checkout(originalBranch)
    } catch (error) {
      await this.git.checkout(originalBranch).catch(() => {})
      throw error
    }
  }

  async abortCherryPick(): Promise<void> {
    try {
      await this.git.raw(["cherry-pick", "--abort"])
    } catch (error) {
      if (!(error instanceof Error)) {
        throw new GitError(GitErrorType.COMMAND_FAILED, {
          underlyingError: error,
        })
      }
      if (
        !error.message?.includes("no-cherry-pick") &&
        !error.message?.includes("no operation in progress")
      ) {
        throw error
      }
    }
  }

  // TODO
  // rebaseWithGluIdInject(commits: Commit[])

  // MARK: Helpers

  async ensureOnBranch(targetBranch: string): Promise<void> {
    const currentBranch = await this.git.getCurrentBranch()
    if (currentBranch !== targetBranch) {
      await this.git.checkout(targetBranch)
    }
  }

  async handleCherryPickError(
    error: unknown,
    commit: Commit,
    index: number,
    total: number
  ) {
    const hasConflicts = await this.git.hasConflicts()

    if (hasConflicts) {
      const conflictFiles = await this.git.getConflictFiles()

      await this.abortCherryPick()

      throw new GitError(GitErrorType.CHERRY_PICK_CONFLICT, {
        commit: commit.hash,
        commitMessage: commit.body,
        commitIndex: index + 1,
        totalCommits: total,
        appliedCount: index,
        conflictFiles,
      })
    }

    throw new GitError(GitErrorType.CHERRY_PICK_FAILED, {
      commit: commit.hash,
      commitMessage: commit.body,
      commitIndex: index + 1,
      originalError: error instanceof Error ? error.message : String(error),
    })
  }

  isCommitsContiguous(commits: IndexedCommit[]): boolean {
    const indexes = commits.map((c) => c.gluIndex)

    if (!indexes.length || indexes.length === 1) {
      return false
    }

    let isCommitsContiguous = true
    let previousIndex = indexes[0]!
    for (const currentIndex of indexes.slice(1, indexes.length)) {
      if (currentIndex !== previousIndex + 1) {
        isCommitsContiguous = false
        break
      }
      previousIndex = currentIndex
    }
    return isCommitsContiguous
  }
}
