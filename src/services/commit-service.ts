import { GitError, GitErrorType } from "../core/errors/git-error.js"
import { ValidationError } from "../core/errors/validation-error.js"
import type {
  Commit,
  CommitComparison,
  IndexedCommit,
  ParsedRange,
  WorkingDirectoryStatus,
} from "../core/types.js"
import type { GitAdapter } from "../infrastructure/git-adapter.js"

export class CommitService {
  constructor(private git: GitAdapter) {}

  // MARK: Queries

  async getCurrentBranch(): Promise<string> {
    return await this.git.getCurrentBranch()
  }

  async getUpstreamBranch(branch: string): Promise<string> {
    try {
      return await this.git.getUpstreamBranch(branch)
    } catch (error) {
      throw new GitError(GitErrorType.ORIGIN_NOT_FOUND, {
        underlyingError: error,
      })
    }
  }

  async getUnpushedCommits(): Promise<IndexedCommit[]> {
    const currentBranch = await this.git.getCurrentBranch()

    if (currentBranch === "HEAD") {
      throw new GitError(GitErrorType.DETACHED_HEAD, {
        operation: "get_unpushed_commits",
      })
    }
    const upstream = await this.git.getUpstreamBranch(currentBranch)

    try {
      await this.git.revparse(["--verify", upstream])
    } catch {
      throw new GitError(GitErrorType.ORIGIN_NOT_FOUND, {
        branch: currentBranch,
        upstreamBranch: upstream,
      })
    }

    // commits come in order of newest-to-earliest, so flip
    const commits = (await this.git.getCommitRange(upstream, "HEAD")).reverse()

    return commits.map((commit, index) => ({
      ...commit,
      gluIndex: index + 1,
    }))
  }

  async getAheadBehindStatus(): Promise<CommitComparison> {
    const localRef = await this.git.getCurrentBranch()
    const remoteRef = `origin/${localRef}`
    try {
      const command = [
        "rev-list",
        "--left-right",
        "--count",
        `${localRef}...${remoteRef}`,
      ]
      const result = await this.git.raw(command)

      const trimmed = result.trim()
      const parts = trimmed.split("\t")

      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new GitError(GitErrorType.INVALID_COMMIT_RANGE, {
          command: command.join(" "),
          output: result,
          localRef,
          remoteRef,
        })
      }
      const ahead = parseInt(parts[0], 10)
      const behind = parseInt(parts[1], 10)

      if (isNaN(ahead) || isNaN(behind)) {
        throw new GitError(GitErrorType.COMMAND_FAILED, {
          command: command.join(" "),
          output: result,
          parsedAhead: parts[0],
          parsedBehind: parts[1],
          localRef,
          remoteRef,
        })
      }

      return {
        ahead,
        behind,
        isAhead: ahead > 0,
        isBehind: behind > 0,
        isUpToDate: ahead === 0 && behind === 0,
      }
    } catch (error) {
      if (error instanceof GitError) {
        throw error
      }

      if (
        error instanceof Error &&
        error.message.includes("unknown revision")
      ) {
        throw new GitError(GitErrorType.BRANCH_NOT_FOUND, {
          branch: localRef,
          upstream: remoteRef,
          originalError: error,
        })
      }
      throw new GitError(GitErrorType.BRANCH_COMPARISON_FAILED, {
        branch: localRef,
        upstream: remoteRef,
        originalError: error,
      })
    }
  }

  async getCommitsBetween(from: string, to: string): Promise<Commit[]> {
    return []
  }

  // MARK: Commit Range

  parseRange(range: string): ParsedRange {
    const trimmed = range.trim()

    // Validate format
    if (!/^\d+(-\d+)?$/.test(trimmed)) {
      throw new ValidationError(
        'Invalid range format. Use "n" or "n-m" where n and m are numbers.',
        { range, format: "expected n or n-m" }
      )
    }

    // Parse single number
    if (!trimmed.includes("-")) {
      const single = parseInt(trimmed)
      if (isNaN(single)) {
        throw new ValidationError("Invalid number in range", { range })
      }
      return {
        startIndex: single - 1, // Convert to 0-based
        endIndex: single - 1,
      }
    }

    // Parse range
    const parts = trimmed.split("-")
    if (parts.length !== 2) {
      throw new ValidationError('Invalid range format. Use "n-m" for ranges.', {
        range,
      })
    }

    const start = parseInt(parts[0]!)
    const end = parseInt(parts[1]!)

    if (isNaN(start) || isNaN(end)) {
      throw new ValidationError("Invalid numbers in range", { range })
    }

    if (start > end) {
      throw new ValidationError(
        "Start index must be less than or equal to end index",
        { range, start, end }
      )
    }

    if (start < 1) {
      throw new ValidationError("Indices must start from 1", { range, start })
    }

    return {
      startIndex: start - 1, // Convert to 0-based
      endIndex: end - 1,
    }
  }

  validateRangeBounds(parsed: ParsedRange, commits: Commit[]): void {
    if (commits.length === 0) {
      throw new ValidationError("No commits available", { parsed })
    }
    if (parsed.startIndex < 0 || parsed.startIndex >= commits.length) {
      throw new ValidationError(
        `Start index ${parsed.startIndex + 1} is out of range (1-${commits.length})`,
        { range: parsed, availableCommits: commits.length }
      )
    }

    if (parsed.endIndex < 0 || parsed.endIndex >= commits.length) {
      throw new ValidationError(
        `End index ${parsed.endIndex + 1} is out of range (1-${commits.length})`,
        { range: parsed, availableCommits: commits.length }
      )
    }
  }

  async getCommitsInRange(range: string): Promise<IndexedCommit[]> {
    const parsed = this.parseRange(range)
    const allCommits = await this.getUnpushedCommits()

    this.validateRangeBounds(parsed, allCommits)

    return allCommits.slice(parsed.startIndex, parsed.endIndex + 1)
  }

  // MARK: Working Directory

  async isWorkingDirectoryClean(): Promise<boolean> {
    const status = await this.git.getStatus()
    return status.isClean()
  }

  async getWorkingDirectoryStatus(): Promise<WorkingDirectoryStatus> {
    const status = await this.git.getStatus()

    return {
      isClean: status.isClean(),
      modified: status.modified,
      staged: status.staged,
      created: status.created,
      deleted: status.deleted,
      untracked: status.not_added,
      conflicted: status.conflicted,
    }
  }

  async requireCleanWorkingDirectory(): Promise<void> {
    const status = await this.getWorkingDirectoryStatus()

    if (!status.isClean) {
      throw new GitError(GitErrorType.DIRTY_WORKING_DIRECTORY, {
        modified: status.modified,
        staged: status.staged,
        untracked: status.untracked,
      })
    }
  }
}
