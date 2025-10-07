export enum GitErrorType {
  BRANCH_NOT_FOUND = "BRANCH_NOT_FOUND",
  ORIGIN_NOT_FOUND = "ORIGIN_NOT_FOUND",
  DETACHED_HEAD = "DETACHED_HEAD",
  NO_COMMITS_IN_RANGE = "NO_COMMITS_IN_RANGE",
  CHERRY_PICK_CONFLICT = "CHERRY_PICK_CONFLICT",
  CHERRY_PICK_FAILED = "CHERRY_PICK_FAILED",
  INVALID_COMMIT_RANGE = "INVALID_COMMIT_RANGE",
  REPOSITORY_NOT_FOUND = "REPOSITORY_NOT_FOUND",
  BRANCH_ALREADY_EXISTS = "BRANCH_ALREADY_EXISTS",
  BRANCH_COMPARISON_FAILED = "BRANCH_COMPARISON_FAILED",
  UNCOMMITTED_CHANGES = "UNCOMMITTED_CHANGES",
  INVALID_GIT_OUTPUT = "INVALID_GIT_OUTPUT",
  DIRTY_WORKING_DIRECTORY = "DIRTY_WORKING_DIRECTORY",
}

export enum GluErrorType {
  TRACKING_FILE_CORRUPT = "TRACKING_FILE_CORRUPT",
  INVALID_GLU_ID = "INVALID_GLU_ID",
  GLU_ID_NOT_FOUND = "GLU_ID_NOT_FOUND",
  BRANCH_TRACKING_FAILED = "BRANCH_TRACKING_FAILED",
}

export class GitError extends Error {
  constructor(
    public type: GitErrorType,
    public context: Record<string, any> = {},
    message?: string
  ) {
    super(message || type)
    this.name = "GitError"
  }
}

export class ValidationError extends Error {
  constructor(
    message?: string,
    public context: Record<string, any> = {}
  ) {
    super(message)
    this.name = "ValidationError"
  }
}

export class GluError extends Error {
  constructor(
    public type: GluErrorType,
    public context: Record<string, any> = {},
    message?: string
  ) {
    super(message || type)
    this.name = "GluError"
  }
}
