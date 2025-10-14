import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { GluIdService } from "./glu-id-service.js"
import type { Commit } from "../core/types.js"
import type { GitAdapter } from "../infrastructure/git-adapter.js"

class MockGitAdapter {
  private commits: Map<string, Commit> = new Map()
  private rebaseInProgress = false

  async raw(args: string[]): Promise<string> {
    const command = args[0]

    if (command === "log") {
      const hash = args[args.length - 1]!
      const format = args.find((a) => a.startsWith("--pretty="))

      if (format === "--pretty=%B") {
        const commit = this.commits.get(hash)
        return commit?.body || ""
      }
      if (format === "--pretty=%s") {
        const commit = this.commits.get(hash)
        return commit?.subject || ""
      }
      if (format === "--pretty=%H %s") {
        const lines: string[] = []
        for (const [hash, commit] of this.commits.entries()) {
          lines.push(`${hash} ${commit.subject}`)
        }
        return lines.join("\n")
      }
    }

    if (command === "revparse") {
      if (args.includes("REBASE_HEAD")) {
        if (this.rebaseInProgress) {
          return "REBASE_HEAD"
        }
        throw new Error("Not rebasing")
      }

      if (args[1]?.endsWith("^")) {
        const hash = args[1].slice(0, -1)
        return `parent-of-${hash}`
      }
    }

    if (command === "commit") {
      return "Committed"
    }

    if (command === "checkout") {
      return "Checked out"
    }

    if (command === "config") {
      return "Config set"
    }

    if (command === "rebase") {
      if (args.includes("--abort")) {
        this.rebaseInProgress = false
        return "Rebase aborted"
      }
    }

    return ""
  }

  async revparse(args: string[]): Promise<string> {
    return this.raw(["revparse", ...args])
  }

  async checkout(target: string): Promise<void> {
    await this.raw(["checkout", target])
  }

  setCommit(hash: string, commit: Commit): void {
    this.commits.set(hash, commit)
  }

  getCommit(hash: string): Commit | undefined {
    return this.commits.get(hash)
  }

  setRebaseInProgress(inProgress: boolean): void {
    this.rebaseInProgress = inProgress
  }
}

describe("GluIdService", () => {
  let service: GluIdService
  let mockGit: Partial<GitAdapter>

  beforeEach(() => {
    mockGit = {
      raw: vi.fn().mockResolvedValue(""),
    }
    service = new GluIdService(mockGit as GitAdapter)
  })

  describe("ensureCommitsHaveGluIds", () => {
    it("returns correct counts for empty commits array", async () => {
      const result = await service.ensureCommitsHaveGluIds([])

      expect(result.commitsProcessed).toBe(0)
      expect(result.commitsModified).toBe(0)
    })

    it("returns correct counts when all commits have glu IDs", async () => {
      const commits: Commit[] = [
        {
          hash: "abc123",
          subject: "feat: add feature",
          body: "feat: add feature\n\nGlu-ID: glu_existing_123",
        },
        {
          hash: "def456",
          subject: "fix: bug",
          body: "fix: bug\n\nGlu-ID: glu_existing_456",
        },
      ]

      const result = await service.ensureCommitsHaveGluIds(commits)

      expect(result.commitsProcessed).toBe(2)
      expect(result.commitsModified).toBe(0)
    })

    it("identifies commits needing glu IDs", async () => {
      const commits: Commit[] = [
        {
          hash: "abc123",
          subject: "feat: with id",
          body: "feat: with id\n\nGlu-ID: glu_existing_123",
        },
        {
          hash: "def456",
          subject: "feat: without id",
          body: "feat: without id",
        },
        {
          hash: "ghi789",
          subject: "fix: without id",
          body: "fix: without id",
        },
      ]

      // Mock the injection to not actually run
      const injectSpy = vi
        .spyOn(service as any, "injectGluIds")
        .mockResolvedValue(undefined)

      const result = await service.ensureCommitsHaveGluIds(commits)

      expect(result.commitsProcessed).toBe(3)
      expect(result.commitsModified).toBe(2) // 2 commits without IDs
      expect(injectSpy).toHaveBeenCalledWith(commits)
    })

    it("does not call injectGluIds when all commits have IDs", async () => {
      const commits: Commit[] = [
        {
          hash: "abc123",
          subject: "feat: with id",
          body: "feat: with id\n\nGlu-ID: glu_existing_123",
        },
      ]

      const injectSpy = vi.spyOn(service as any, "injectGluIds")

      await service.ensureCommitsHaveGluIds(commits)

      expect(injectSpy).not.toHaveBeenCalled()
    })
  })

  describe("getGluId", () => {
    it("returns null for commit without glu ID", async () => {
      mockGit.raw = vi
        .fn()
        .mockResolvedValue("feat: test commit\n\nSome description")

      const gluId = await service.getGluId("abc123")

      expect(gluId).toBeNull()
      expect(mockGit.raw).toHaveBeenCalledWith([
        "log",
        "-1",
        "--pretty=%B",
        "abc123",
      ])
    })

    it("extracts glu ID from commit body", async () => {
      mockGit.raw = vi
        .fn()
        .mockResolvedValue(
          "feat: test\n\nSome description\n\nGlu-ID: glu_test_abc123def"
        )

      const gluId = await service.getGluId("abc123")

      expect(gluId).toBe("glu_test_abc123def")
    })

    it("handles multiple trailers and extracts glu ID", async () => {
      mockGit.raw = vi
        .fn()
        .mockResolvedValue(
          "feat: test\n\nSigned-off-by: User <user@example.com>\nGlu-ID: glu_test_123\nCo-authored-by: Other <other@example.com>"
        )

      const gluId = await service.getGluId("abc123")

      expect(gluId).toBe("glu_test_123")
    })

    it("returns null when git command fails", async () => {
      mockGit.raw = vi.fn().mockRejectedValue(new Error("Commit not found"))

      const gluId = await service.getGluId("nonexistent")

      expect(gluId).toBeNull()
    })
  })

  describe("hasGluId", () => {
    it("returns false for commit without glu ID", async () => {
      mockGit.raw = vi.fn().mockResolvedValue("feat: test")

      const result = await service.hasGluId("abc123")

      expect(result).toBe(false)
    })

    it("returns true for commit with glu ID", async () => {
      mockGit.raw = vi
        .fn()
        .mockResolvedValue("feat: test\n\nGlu-ID: glu_test_123")

      const result = await service.hasGluId("abc123")

      expect(result).toBe(true)
    })

    it("returns false when git command fails", async () => {
      mockGit.raw = vi.fn().mockRejectedValue(new Error("Commit not found"))

      const result = await service.hasGluId("nonexistent")

      expect(result).toBe(false)
    })
  })

  describe("error handling", () => {
    it("handles errors in getGluId gracefully", async () => {
      mockGit.raw = vi.fn().mockRejectedValue(new Error("Git error"))

      const gluId = await service.getGluId("abc123")

      expect(gluId).toBeNull()
    })
  })
})
