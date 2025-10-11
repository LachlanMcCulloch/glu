import { GitError, GitErrorType } from "../core/errors/git-error.js"
import type { Branch, PushResult } from "../core/types.js"
import type { GitAdapter } from "../infrastructure/git-adapter.js"

export class BranchService {
  constructor(private git: GitAdapter) {}

  // MARK: Branch management

  async getCurrentBranch(): Promise<Branch> {
    const name = await this.git.getCurrentBranch()
    const upstream = await this.git.getUpstreamBranch(name)

    return {
      name,
      isRemote: false,
      upstream,
    }
  }

  async getUpstream(branch: string): Promise<string | null> {
    try {
      return await this.git.getUpstreamBranch(branch)
    } catch {
      return null
    }
  }

  async createTempBranch(prefix?: string): Promise<string> {
    const timestamp = Date.now()
    const branchName = `${prefix}/${timestamp}`

    const currentBranch = await this.git.getCurrentBranch()
    const upstream = await this.git.getUpstreamBranch(currentBranch)

    await this.git.createBranchFrom(branchName, upstream)
    return branchName
  }

  async createBranchFrom(
    newBranch: string,
    sourceBranch: string,
    force = false
  ): Promise<void> {
    try {
      await this.git.createBranchFrom(newBranch, sourceBranch, force)
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        throw new GitError(GitErrorType.BRANCH_ALREADY_EXISTS, {
          branchName: newBranch,
          sourceBranch,
        })
      }

      throw new GitError(GitErrorType.BRANCH_CREATION_FAILED, {
        branchName: newBranch,
        sourceBranch,
        originalError: error.message,
      })
    }
  }

  async deleteBranch(name: string): Promise<void> {
    await this.git.deleteLocalBranch(name, true)
  }

  async push(
    branch: string,
    remote: string,
    force?: boolean
  ): Promise<PushResult> {
    try {
      const options = force ? ["--force"] : []
      return await this.git.push(remote, branch, options)
    } catch (error: any) {
      if (
        error.message?.includes("non-fast-forward") ||
        error.message?.includes("rejected")
      ) {
        throw new GitError(GitErrorType.PUSH_REJECTED, {
          branch,
          remote,
          reason: "non-fast-forward",
          originalError: error.message,
        })
      }
      throw error
    }
  }

  async checkout(branch: string): Promise<void> {
    await this.git.checkout(branch)
  }

  // MARK: Branch queries

  async exists(name: string): Promise<boolean> {
    return await this.git.branchExists(name)
  }

  async getBranch(name: string): Promise<Branch | null> {
    const exists = await this.exists(name)
    if (!exists) return null

    const upstream = await this.getUpstream(name)

    return {
      name,
      isRemote: false,
      upstream,
    }
  }
}
