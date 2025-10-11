import type { Commit } from "../core/types.js"
import type { GluConfig } from "../config/schema.js"

export interface BranchNameOptions {
  customName?: string
  range?: string
}

export class BranchNamingService {
  constructor(private config: GluConfig) {}

  generate(commits: Commit[], options: BranchNameOptions = {}): string {
    if (options.customName) {
      return options.customName
    }

    if (commits.length === 0) {
      return this.fallbackName(options.range || "unknown")
    }
    return this.generateSingleCommitName(commits[0]!, options.range)
  }

  // MARK: Helpers: Generators

  generateSingleCommitName(commit: Commit, range?: string): string {
    const formatted = this.formatCommitMessage(commit.subject)
    if (!formatted) {
      return this.fallbackName(range || "1")
    }
    return this.applyPrefix(formatted)
  }

  // MARK: Helpers: Formatters

  formatCommitMessage(message: string): string {
    let formatted = message.toLowerCase()
    formatted = this.stripConventionalCommitPrefixes(formatted)
    formatted = this.sanitizeAndFormat(formatted)
    return formatted
  }

  stripConventionalCommitPrefixes(message: string): string {
    const prefixes = this.config.conventionalCommits?.stripPrefixes || []
    for (const prefix of prefixes) {
      const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const regex = new RegExp(`^${escapedPrefix}\\s*`, "i")
      message = message.replace(regex, "")
    }
    return message
  }

  private sanitizeAndFormat(message: string): string {
    const separator = this.config.formatting?.separator || "-"
    const maxLength = this.config.formatting?.maxBranchLength || 50

    return message
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, separator)
      .replace(/-+/g, separator)
      .replace(/^-|-$/g, "")
      .slice(0, maxLength)
  }

  // MARK: Helpers

  applyPrefix(branchName: string): string {
    const prefix = this.config.branchPrefix || ""
    return prefix.length ? `${prefix}${branchName}` : branchName
  }

  fallbackName(range: string): string {
    return this.applyPrefix(`glu/tmp/${range}`)
  }
}
