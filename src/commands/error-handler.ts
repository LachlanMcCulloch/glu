import {
  GitError,
  GitErrorType,
  GluError,
  GluErrorType,
} from "../core/errors.js"

export interface ErrorResult {
  message: string
  exitCode: number
}

export function translateError(error: Error, command?: string): ErrorResult {
  if (error instanceof GitError) {
    return translateGitError(error, command)
  }

  if (error instanceof GluError) {
    return translateGluError(error, command)
  }

  // Unknown error
  return {
    message: `Unexpected error: ${error.message}`,
    exitCode: 1,
  }
}

function translateGitError(error: GitError, command?: string): ErrorResult {
  switch (error.type) {
    case GitErrorType.DETACHED_HEAD:
      return {
        message: buildDetachedHeadMessage(command),
        exitCode: 1,
      }

    case GitErrorType.ORIGIN_NOT_FOUND:
      return {
        message: `No origin branch found for ${error.context.branch}. Push the branch first or there are no commits to compare.`,
        exitCode: 1,
      }

    case GitErrorType.BRANCH_NOT_FOUND:
      return {
        message: `Branch not found: ${error.context.localRef || error.context.remoteRef}`,
        exitCode: 1,
      }

    case GitErrorType.CHERRY_PICK_CONFLICT:
      return {
        message: `Cherry-pick conflict occurred. Resolve conflicts and run: git cherry-pick --continue`,
        exitCode: 1,
      }

    case GitErrorType.BRANCH_ALREADY_EXISTS:
      return {
        message: `Branch ${error.context.branchName} already exists. Use --force to overwrite.`,
        exitCode: 1,
      }

    case GitErrorType.INVALID_COMMIT_RANGE:
      return {
        message: `Invalid range: ${error.context.range}. Available commits: 1-${error.context.availableCommits}`,
        exitCode: 1,
      }

    case GitErrorType.NO_COMMITS_IN_RANGE:
      return {
        message: `No commits found in range ${error.context.from}..${error.context.to}`,
        exitCode: 1,
      }

    case GitErrorType.BRANCH_COMPARISON_FAILED:
      return {
        message: `Failed to compare ${error.context.localRef} with ${error.context.remoteRef}`,
        exitCode: 1,
      }
    case GitErrorType.INVALID_GIT_OUTPUT:
      return {
        message: `Invalid git output from command: ${error.context.command}`,
        exitCode: 1,
      }

    case GitErrorType.REPOSITORY_NOT_FOUND:
      return {
        message: "Not a git repository or git command failed",
        exitCode: 1,
      }

    default:
      return {
        message: `Git operation failed: ${error.message}`,
        exitCode: 1,
      }
  }
}

function translateGluError(error: GluError, command?: string): ErrorResult {
  switch (error.type) {
    case GluErrorType.TRACKING_FILE_CORRUPT:
      return {
        message: `Branch tracking file is corrupted. Run: glu cleanup`,
        exitCode: 1,
      }

    case GluErrorType.INVALID_GLU_ID:
      return {
        message: `Invalid glu-id format: ${error.context.gluId}`,
        exitCode: 1,
      }

    case GluErrorType.GLU_ID_NOT_FOUND:
      return {
        message: `Glu-id not found: ${error.context.gluId}`,
        exitCode: 1,
      }

    case GluErrorType.BRANCH_TRACKING_FAILED:
      return {
        message: `Failed to track branch relationship`,
        exitCode: 1,
      }

    default:
      return {
        message: `Glu operation failed: ${error.message}`,
        exitCode: 1,
      }
  }
}

function buildDetachedHeadMessage(command?: string): string {
  const baseMessage = "Currently in detached HEAD state."

  switch (command) {
    case "list":
      return `${baseMessage} Please checkout a branch to list commits.`
    case "request-review":
      return `${baseMessage} Please checkout a branch before requesting review.`
    default:
      return `${baseMessage} Please checkout a branch.`
  }
}
