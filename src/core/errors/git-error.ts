import { ApplicationError } from "./base-error.js"

export enum GitErrorType {
  BRANCH_NOT_FOUND = "BRANCH_NOT_FOUND",
  ORIGIN_NOT_FOUND = "ORIGIN_NOT_FOUND",
  DETACHED_HEAD = "DETACHED_HEAD",
  CHERRY_PICK_CONFLICT = "CHERRY_PICK_CONFLICT",
  CHERRY_PICK_FAILED = "CHERRY_PICK_FAILED",
  INVALID_COMMIT_RANGE = "INVALID_COMMIT_RANGE",
  BRANCH_ALREADY_EXISTS = "BRANCH_ALREADY_EXISTS",
  BRANCH_COMPARISON_FAILED = "BRANCH_COMPARISON_FAILED",
  BRANCH_CREATION_FAILED = "BRANCH_CREATION_FAILED",
  COMMAND_FAILED = "COMMAND_FAILED",
  DIRTY_WORKING_DIRECTORY = "DIRTY_WORKING_DIRECTORY",
  PUSH_REJECTED = "PUSH_REJECTED",
}

export class GitError extends ApplicationError {
  readonly exitCode = 1

  constructor(
    public readonly type: GitErrorType,
    context?: Record<string, unknown>
  ) {
    super(`Git error: ${type}`, context)
  }

  get userMessage(): string {
    switch (this.type) {
      case GitErrorType.BRANCH_NOT_FOUND:
        return this.branchNotFoundMessage()
      case GitErrorType.ORIGIN_NOT_FOUND:
        return this.originNotFoundMessage()
      case GitErrorType.DETACHED_HEAD:
        return this.detachedHeadMessage()
      case GitErrorType.CHERRY_PICK_CONFLICT:
        return this.cherryPickConflictMessage()
      case GitErrorType.CHERRY_PICK_FAILED:
        return this.cherryPickFailedMessage()
      case GitErrorType.INVALID_COMMIT_RANGE:
        return this.invalidCommitRangeMessage()
      case GitErrorType.BRANCH_ALREADY_EXISTS:
        return this.branchAlreadyExistsMessage()
      case GitErrorType.BRANCH_COMPARISON_FAILED:
        return this.branchComparisonFailedMessage()
      case GitErrorType.BRANCH_CREATION_FAILED:
        return this.branchCreationFailedMessage()
      case GitErrorType.COMMAND_FAILED:
        return this.commandFailedMessage()
      case GitErrorType.DIRTY_WORKING_DIRECTORY:
        return this.dirtyWorkingDirectoryMessage()
      case GitErrorType.PUSH_REJECTED:
        return this.pushRejectedMessage()
      default:
        return `❌ An unexpected git error occurred: ${this.message}`
    }
  }

  // MARK: Git Error User Messages

  private getContext<T>(key: string, defaultValue: T): T {
    const value = this.context?.[key]
    return value !== undefined ? (value as T) : defaultValue
  }

  private branchNotFoundMessage(): string {
    const branch = this.getContext("branchName", "specified branch")

    return [
      `❌ Branch not found: ${branch}`,
      "",
      `The branch '${branch}' does not exist.`,
      "",
      "To see all branches:",
      "  git branch -a",
      "",
      "To create this branch:",
      `  git checkout -b ${branch}`,
    ].join("\n")
  }

  private originNotFoundMessage(): string {
    return [
      "❌ No remote 'origin' configured",
      "",
      "No remote repository named 'origin' is configured for this repository.",
      "",
      "To add a remote:",
      "  git remote add origin <repository-url>",
      "",
      "To see current remotes:",
      "  git remote -v",
    ].join("\n")
  }

  private detachedHeadMessage(): string {
    return [
      "❌ Cannot perform this operation in detached HEAD state",
      "",
      "You're not currently on a branch. Please checkout a branch first:",
      "  git checkout <branch-name>",
      "or create a new branch:",
      "  git checkout -b <new-branch-name>",
    ].join("\n")
  }

  private cherryPickConflictMessage(): string {
    const commitMessage = this.getContext("commitMessage", "unknown")
    const commitIndex = this.getContext("commitIndex", "?")
    const totalCommits = this.getContext("totalCommits", "?")
    const appliedCount = this.getContext("appliedCount", 0)
    const conflictFiles = this.getContext<string[]>("conflictFiles", [])
    const files = conflictFiles.map((f) => `  • ${f}`)

    const lines = [
      `❌ Cherry-pick conflict on commit ${commitIndex}/${totalCommits}`,
      "",
      `Commit: ${commitMessage}`,
    ]

    if (appliedCount > 0) {
      lines.push(`Successfully applied: ${appliedCount} commit(s)`)
      lines.push("")
    }

    lines.push("Conflicting files:")
    lines.push(...files)
    lines.push("")
    lines.push(
      "The cherry-pick has been aborted. Your repository is back to a clean state."
    )

    return lines.join("\n")
  }

  private cherryPickFailedMessage(): string {
    const commitIndex = this.getContext("commitIndex", "")
    const commitMessage = this.getContext("commitMessage", "unknown")
    const originalError = this.getContext("originalError", "Unknown error")

    return [
      `❌ Failed to cherry-pick commit ${commitIndex}`,
      "",
      `Commit: ${commitMessage}`,
      "",
      `Error: ${originalError}`,
      "",
      "The operation has been aborted.",
    ].join("\n")
  }

  private invalidCommitRangeMessage(): string {
    const range = this.getContext("range", "specified range")
    const reason = this.getContext("reason", "invalid format")
    const available = this.getContext("availableCommits", [])

    const lines = [`❌ Invalid commit range: ${range}`, "", reason, ""]

    if (available) {
      lines.push(`Available commits: 1-${available}`)
    }

    lines.push("Use 'glu ls' to see available commits and their indices.")
    lines.push("")
    lines.push("Valid range formats:")
    lines.push('  • Single commit: "2"')
    lines.push('  • Range: "1-3"')
    lines.push('  • Multiple: "1,3,5" (coming soon)')

    return lines.join("\n")
  }

  private branchAlreadyExistsMessage(): string {
    const branch = this.getContext("branchName", "branch")

    return [
      `❌ Branch already exists: ${branch}`,
      "",
      `The branch '${branch}' already exists.`,
      "",
      "To fix this:",
      `  • Delete the existing branch: git branch -D ${branch}`,
      "  • Use a different branch name (feature coming soon)",
    ].join("\n")
  }

  private branchComparisonFailedMessage(): string {
    const branch = this.getContext("branch", "branch")
    const upstream = this.getContext("upstream", "upstream")
    const originalError = this.getContext("originalError", "Unknown error")

    return [
      "❌ Failed to compare branches",
      "",
      `Could not compare '${branch}' with '${upstream}'.`,
      "",
      originalError,
      "",
      "Please ensure both branches exist and try again.",
    ].join("\n")
  }

  private branchCreationFailedMessage(): string {
    const branchName = this.getContext("branchName", "branch")
    const sourceBranch = this.getContext("sourceBranch", "source")
    const originalError = this.getContext("originalError", "Unknown error")

    return [
      `❌ Failed to create branch: ${branchName}`,
      "",
      `Source: ${sourceBranch}`,
      "",
      `Error: ${originalError}`,
      "",
      "Please check the error message and try again.",
    ].join("\n")
  }

  private commandFailedMessage(): string {
    const lines = ["❌ Git command failed", ""]

    if (this.context?.command) {
      lines.push(`Command: ${this.context.command}`)
    }

    lines.push(this.getContext("originalError", "Unknown error"))
    lines.push("")
    lines.push("Please check the error message and try again.")

    return lines.join("\n")
  }

  private dirtyWorkingDirectoryMessage(): string {
    const modified = this.getContext<string[]>("modified", [])
    const staged = this.getContext<string[]>("staged", [])
    const untracked = this.getContext<string[]>("untracked", [])
    const created = this.getContext<string[]>("created", [])
    const deleted = this.getContext<string[]>("deleted", [])

    const lines = ["❌ Working directory is not clean", ""]

    if (modified.length) {
      lines.push("Modified files:")
      lines.push(...(modified as string[]).map((f) => `  • ${f}`))
      lines.push("")
    }

    if (staged.length) {
      lines.push("Staged files:")
      lines.push(...(staged as string[]).map((f) => `  • ${f}`))
      lines.push("")
    }

    if (created.length) {
      lines.push("New files:")
      lines.push(...(created as string[]).map((f) => `  • ${f}`))
      lines.push("")
    }

    if (deleted.length) {
      lines.push("Deleted files:")
      lines.push(...(deleted as string[]).map((f) => `  • ${f}`))
      lines.push("")
    }

    if (untracked.length) {
      lines.push("Untracked files:")
      lines.push(...(untracked as string[]).map((f) => `  • ${f}`))
      lines.push("")
    }

    lines.push("Please commit or stash your changes before proceeding:")
    lines.push("  git add .")
    lines.push('  git commit -m "your message"')
    lines.push("or")
    lines.push("  git stash")

    return lines.join("\n")
  }

  pushRejectedMessage() {
    const branch = this.getContext("branch", "branch")
    const remote = this.getContext("remote", "origin")
    const reason = this.getContext("reason", "non-fast-forward")

    return [
      `❌ Failed to push ${branch} to ${remote}`,
      "",
      `Reason: ${reason}`,
      "",
      "The remote branch has commits that you don't have locally.",
      "",
      "To fix this:",
      `  • Pull and rebase: git pull --rebase ${remote} ${branch}`,
      `  • Force push (CAUTION): git push --force ${remote} ${branch}`,
      "",
      "Note: Force pushing will overwrite remote history. Only use if you're sure.",
    ].join("\n")
  }
}
