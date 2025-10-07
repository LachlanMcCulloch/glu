import type { Commit, IndexedCommit } from "@/core/types.js"
import { simpleGit, type SimpleGit, type StatusResult } from "simple-git"

export interface GitOperations {
  getCurrentBranch(): Promise<string>
  getCommitRange(from: string, to: string): Promise<Commit[]>
  branchExists(branch: string): Promise<boolean>
  cherryPick(commitHash: string, options?: CherryPickOptions): Promise<void>
  cherryPickRange(
    from: string,
    to: string,
    options?: CherryPickOptions
  ): Promise<void>
  hasConflicts(): Promise<boolean>
  getConflictFiles(): Promise<string[]>
  commit(message: string): Promise<void>
  push(remote: string, branch: string, options?: string[]): Promise<void>
  createBranch(name: string): Promise<void>
  createBranchFrom(newBranch: string, sourceBranch: string): Promise<void>
  checkout(branch: string): Promise<void>
  checkoutBranch(newBranch: string, startPoint: string): Promise<void>
  reset(options: string[]): Promise<void>
  revparse(options: string[]): Promise<string>
  deleteLocalBranch(branch: string, force?: boolean): Promise<void>
  getRemotes(verbose?: boolean): Promise<any[]>
  raw(command: string[]): Promise<string>
}

export type CherryPickOptions = {
  noCommit?: boolean
}

/**
 * Git Service wrapper around Simple Git.
 */
export class GitAdapter implements GitOperations {
  private git: SimpleGit

  constructor() {
    this.git = simpleGit()
  }
  async getCurrentBranch(): Promise<string> {
    return await this.git.revparse(["--abbrev-ref", "HEAD"])
  }

  async getUpstreamBranch(branch: string): Promise<string> {
    return await this.git.revparse(["--abbrev-ref", `${branch}@{upstream}`])
  }

  async getCommitRange(from: string, to: string): Promise<Commit[]> {
    const log = await this.git.log({
      from,
      to,
      symmetric: false,
      format: { hash: "%H", subject: "%s", body: "%B" },
    })

    return log.all.map((commit, index) => ({
      hash: commit.hash,
      subject: commit.subject,
      body: commit.body || commit.subject,
    }))
  }

  async branchExists(branch: string): Promise<boolean> {
    try {
      await this.revparse(["--verify", `refs/heads/${branch}`])
      return true
    } catch {
      return false
    }
  }

  async getStatus(): Promise<StatusResult> {
    return await this.git.status()
  }

  async cherryPick(
    commitHash: string,
    options?: CherryPickOptions
  ): Promise<void> {
    const args = ["cherry-pick"]
    if (options?.noCommit) args.push("--no-commit")
    args.push(commitHash)

    await this.git.raw(args)
  }

  async cherryPickRange(
    from: string,
    to: string,
    options?: CherryPickOptions
  ): Promise<void> {
    const args = ["cherry-pick"]
    if (options?.noCommit) args.push("--no-commit")
    args.push(`${from}..${to}`)
    await this.git.raw(args)
  }
  async hasConflicts(): Promise<boolean> {
    try {
      const result = await this.git.diff(["--name-only", "--diff-filter=U"])
      return result.trim().length > 0
    } catch {
      return false
    }
  }

  async getConflictFiles(): Promise<string[]> {
    try {
      const result = await this.git.diff(["--name-only", "--diff-filter=U"])
      return result
        .trim()
        .split("\n")
        .filter((f) => f.length > 0)
    } catch {
      return []
    }
  }

  async commit(message: string): Promise<void> {
    await this.git.commit(message)
  }

  async push(
    remote: string,
    branch: string,
    options: string[] = []
  ): Promise<void> {
    await this.git.push(remote, branch, options)
  }

  async createBranch(name: string): Promise<void> {
    await this.git.checkoutLocalBranch(name)
  }

  async createBranchFrom(
    newBranch: string,
    sourceBranch: string
  ): Promise<void> {
    await this.git.branch([newBranch, sourceBranch])
  }

  async checkout(branch: string): Promise<void> {
    await this.git.checkout(branch)
  }

  async checkoutBranch(newBranch: string, startPoint: string): Promise<void> {
    await this.git.checkoutBranch(newBranch, startPoint)
  }

  async reset(options: string[]): Promise<void> {
    await this.git.reset(options)
  }

  async revparse(options: string[]): Promise<string> {
    return await this.git.revparse(options)
  }

  async deleteLocalBranch(branch: string, force = false): Promise<void> {
    await this.git.deleteLocalBranch(branch, force)
  }

  async getRemotes(verbose = false): Promise<any[]> {
    // For some reason needs to be unwrapped into true or false
    if (verbose) {
      return await this.git.getRemotes(verbose)
    } else {
      return await this.git.getRemotes(verbose)
    }
  }

  async raw(command: string[]): Promise<string> {
    return await this.git.raw(command)
  }
}
