import { translateError } from "./error-handler.js"
import { GitError, GitErrorType } from "../core/errors.js"

export function translateListError(error: Error): {
  message: string
  exitCode: number
} {
  if (error instanceof GitError) {
    switch (error.type) {
      case GitErrorType.NO_COMMITS_IN_RANGE:
        // For list, this might not be an error - just informational
        return {
          message:
            "No unpushed commits found. All commits are already on origin.",
          exitCode: 0,
        }

      case GitErrorType.DETACHED_HEAD:
        return {
          message:
            "Currently in detached HEAD state. Please checkout a branch to list commits.",
          exitCode: 1,
        }

      default:
        return translateError(error, "list")
    }
  }

  return translateError(error, "list")
}
