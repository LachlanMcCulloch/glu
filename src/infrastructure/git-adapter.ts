import type { Commit } from "@/core/types.js"
import { simpleGit, type SimpleGit } from "simple-git"

export interface GitOperations {
  getCurrentBranch(): Promise<string>
  getCommitRange(from: string, to: string): Promise<Commit[]>
  cherryPick(commitHash: string, noCommit?: boolean): Promise<void>
  commit(message: string): Promise<void>
  checkout(branch: string): Promise<void>
  checkoutBranch(newBranch: string, startPoint: string): Promise<void>
  reset(options: string[]): Promise<void>
  revparse(options: string[]): Promise<string>
  deleteLocalBranch(branch: string, force?: boolean): Promise<void>
  getRemotes(verbose?: boolean): Promise<any[]>
  raw(command: string[]): Promise<string>
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

  async getCommitRange(from: string, to: string): Promise<Commit[]> {
    const log = await this.git.log({
      from,
      to,
      symmetric: false,
      format: { hash: "%H", subject: "%s", body: "%B" },
    })

    return log.all.map((commit) => ({
      hash: commit.hash,
      subject: commit.subject,
      body: commit.body || commit.subject,
    }))
  }

  async cherryPick(commitHash: string, noCommit = false): Promise<void> {
    const args = ["cherry-pick"]
    if (noCommit) args.push("--no-commit")
    args.push(commitHash)

    await this.git.raw(args)
  }

  async commit(message: string): Promise<void> {
    await this.git.commit(message)
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
