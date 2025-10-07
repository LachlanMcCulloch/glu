import type { Branch } from "../core/types.js"
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
    sourceBranch: string
  ): Promise<void> {
    await this.git.createBranchFrom(newBranch, sourceBranch)
  }

  async deleteBranch(name: string): Promise<void> {
    await this.git.deleteLocalBranch(name, true)
  }

  async push(branch: string, remote: string): Promise<void> {
    await this.git.push(remote, branch)
  }

  async checkout(branch: string): Promise<void> {
    await this.git.checkout(branch)
  }

  // MARK: Branch queries

  async exists(name: string): Promise<boolean> {
    return await this.git.branchExists(name)
  }

  async getUpstream(branch: string): Promise<string | null> {
    try {
      return await this.git.getUpstreamBranch(branch)
    } catch {
      return null
    }
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
