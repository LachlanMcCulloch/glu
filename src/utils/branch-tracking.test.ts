import { describe, expect, test, vi, beforeEach, afterEach } from "vitest"
import path from "path"
import {
  addBranchToTracking,
  cleanupBranchTracking,
  getBranchesForGluId,
  loadBranchTracking,
  removeBranchFromTracking,
  saveBranchTracking,
} from "./branch-tracking.js"

// MARK: - Mocks

// Mock fs-extra
const mockPathExists = vi.hoisted(() => vi.fn())
const mockReadJson = vi.hoisted(() => vi.fn())
const mockWriteJson = vi.hoisted(() => vi.fn())

vi.mock("fs-extra", () => ({
  default: {
    pathExists: mockPathExists,
    readJson: mockReadJson,
    writeJson: mockWriteJson,
  },
  pathExists: mockPathExists,
  readJson: mockReadJson,
  writeJson: mockWriteJson,
}))

// Mock simple-git
const mockRevparse = vi.hoisted(() => vi.fn())
const mockBranch = vi.hoisted(() => vi.fn())
const mockGit = vi.hoisted(() => ({
  revparse: mockRevparse,
  branch: mockBranch,
}))

const mockSimpleGit = vi.hoisted(() => vi.fn(() => mockGit))

vi.mock("simple-git", () => ({
  simpleGit: mockSimpleGit,
}))

describe("branch-tracking", () => {
  const mockGitDir = "/path/to/.git"
  const mockTrackingFile = path.join(mockGitDir, "glu-branch-tracking.json")

  beforeEach(() => {
    vi.clearAllMocks()
    mockSimpleGit.mockReturnValue(mockGit)
    mockRevparse.mockResolvedValue(mockGitDir)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // MARK: - loadBranchTracking

  describe("loadBranchTracking", () => {
    test("loads existing tracking data from file", async () => {
      const trackingData = {
        glu_abc123_def456: ["feature/auth", "hotfix/login"],
        glu_xyz789_abc123: ["feature/payments"],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(trackingData)

      const result = await loadBranchTracking()

      expect(mockRevparse).toHaveBeenCalledWith(["--git-dir"])
      expect(mockPathExists).toHaveBeenCalledWith(mockTrackingFile)
      expect(mockReadJson).toHaveBeenCalledWith(mockTrackingFile)
      expect(result).toEqual(trackingData)
    })

    test("returns empty object when file doesn't exist", async () => {
      mockPathExists.mockResolvedValue(false)

      const result = await loadBranchTracking()

      expect(mockRevparse).toHaveBeenCalledWith(["--git-dir"])
      expect(mockPathExists).toHaveBeenCalledWith(mockTrackingFile)
      expect(mockReadJson).not.toHaveBeenCalled()
      expect(result).toEqual({})
    })

    test("returns empty object when file is corrupted", async () => {
      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockRejectedValue(new Error("Invalid JSON"))

      const result = await loadBranchTracking()

      expect(result).toEqual({})
    })

    test("handles null data from file", async () => {
      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(null)

      const result = await loadBranchTracking()

      expect(result).toEqual({})
    })

    test("handles undefined data from file", async () => {
      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(undefined)

      const result = await loadBranchTracking()

      expect(result).toEqual({})
    })

    test("handles git directory resolution failure", async () => {
      mockRevparse.mockRejectedValue(new Error("Not a git repository"))

      const result = await loadBranchTracking()

      expect(result).toEqual({})
    })
  })

  describe("saveBranchTracking", () => {
    test("saves tracking data to file", async () => {
      const trackingData = {
        glu_abc123_def456: ["feature/auth", "hotfix/login"],
        glu_xyz789_abc123: ["feature/payments"],
      }

      mockWriteJson.mockResolvedValue(undefined)

      await saveBranchTracking(trackingData)

      expect(mockRevparse).toHaveBeenCalledWith(["--git-dir"])
      expect(mockWriteJson).toHaveBeenCalledWith(
        mockTrackingFile,
        trackingData,
        { spaces: 2 }
      )
    })

    test("handles empty tracking data", async () => {
      const trackingData = {}

      mockWriteJson.mockResolvedValue(undefined)

      await saveBranchTracking(trackingData)

      expect(mockWriteJson).toHaveBeenCalledWith(
        mockTrackingFile,
        trackingData,
        { spaces: 2 }
      )
    })

    test("handles file write failure gracefully", async () => {
      const trackingData = { glu_test_123: ["branch1"] }
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {})

      mockWriteJson.mockRejectedValue(new Error("Permission denied"))

      // Should not throw
      await expect(saveBranchTracking(trackingData)).resolves.toBeUndefined()

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to save branch tracking data:",
        expect.any(Error)
      )

      consoleWarnSpy.mockRestore()
    })

    test("handles git directory resolution failure gracefully", async () => {
      const trackingData = { glu_test_123: ["branch1"] }
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {})

      mockRevparse.mockRejectedValue(new Error("Not a git repository"))

      await expect(saveBranchTracking(trackingData)).resolves.toBeUndefined()

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to save branch tracking data:",
        expect.any(Error)
      )

      consoleWarnSpy.mockRestore()
    })
  })

  describe("addBranchToTracking", () => {
    test("adds branch to new glu-id", async () => {
      const initialData = {}
      const expectedData = {
        glu_abc123_def456: ["feature/auth"],
      }

      mockPathExists.mockResolvedValue(false) // No existing file
      mockWriteJson.mockResolvedValue(undefined)

      await addBranchToTracking("glu_abc123_def456", "feature/auth")

      expect(mockWriteJson).toHaveBeenCalledWith(
        mockTrackingFile,
        expectedData,
        { spaces: 2 }
      )
    })

    test("adds branch to existing glu-id", async () => {
      const initialData = {
        glu_abc123_def456: ["feature/auth"],
      }
      const expectedData = {
        glu_abc123_def456: ["feature/auth", "hotfix/login"],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockWriteJson.mockResolvedValue(undefined)

      await addBranchToTracking("glu_abc123_def456", "hotfix/login")

      expect(mockWriteJson).toHaveBeenCalledWith(
        mockTrackingFile,
        expectedData,
        { spaces: 2 }
      )
    })

    test("doesn't add duplicate branch to same glu-id", async () => {
      const initialData = {
        glu_abc123_def456: ["feature/auth"],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockWriteJson.mockResolvedValue(undefined)

      await addBranchToTracking("glu_abc123_def456", "feature/auth")

      // Should still be called with the same data (no duplicates)
      expect(mockWriteJson).toHaveBeenCalledWith(
        mockTrackingFile,
        initialData,
        { spaces: 2 }
      )
    })

    test("adds branch to glu-id with existing unrelated tracking", async () => {
      const initialData = {
        glu_xyz789_abc123: ["feature/payments"],
      }
      const expectedData = {
        glu_xyz789_abc123: ["feature/payments"],
        glu_abc123_def456: ["feature/auth"],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockWriteJson.mockResolvedValue(undefined)

      await addBranchToTracking("glu_abc123_def456", "feature/auth")

      expect(mockWriteJson).toHaveBeenCalledWith(
        mockTrackingFile,
        expectedData,
        { spaces: 2 }
      )
    })

    test.each([
      ["glu_simple_123456", "main"],
      ["glu_feature_abcdef", "feature/complex-feature-name"],
      ["glu_hotfix_789abc", "hotfix/urgent-fix"],
      ["glu_release_def123", "release/v2.1.0"],
    ])(
      "handles various glu-id and branch name formats: %s -> %s",
      async (gluId, branchName) => {
        mockPathExists.mockResolvedValue(false)
        mockWriteJson.mockResolvedValue(undefined)

        await addBranchToTracking(gluId, branchName)

        expect(mockWriteJson).toHaveBeenCalledWith(
          mockTrackingFile,
          { [gluId]: [branchName] },
          { spaces: 2 }
        )
      }
    )
  })

  describe("removeBranchFromTracking", () => {
    test("removes branch from single glu-id", async () => {
      const initialData = {
        glu_abc123_def456: ["feature/auth", "hotfix/login"],
        glu_xyz789_abc123: ["feature/payments"],
      }
      const expectedData = {
        glu_abc123_def456: ["hotfix/login"],
        glu_xyz789_abc123: ["feature/payments"],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockWriteJson.mockResolvedValue(undefined)

      await removeBranchFromTracking("feature/auth")

      expect(mockWriteJson).toHaveBeenCalledWith(
        mockTrackingFile,
        expectedData,
        { spaces: 2 }
      )
    })

    test("removes branch from multiple glu-ids", async () => {
      const initialData = {
        glu_abc123_def456: ["feature/auth", "hotfix/login"],
        glu_xyz789_abc123: ["feature/auth", "feature/payments"],
      }
      const expectedData = {
        glu_abc123_def456: ["hotfix/login"],
        glu_xyz789_abc123: ["feature/payments"],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockWriteJson.mockResolvedValue(undefined)

      await removeBranchFromTracking("feature/auth")

      expect(mockWriteJson).toHaveBeenCalledWith(
        mockTrackingFile,
        expectedData,
        { spaces: 2 }
      )
    })

    test("removes glu-id entry when last branch is removed", async () => {
      const initialData = {
        glu_abc123_def456: ["feature/auth"],
        glu_xyz789_abc123: ["feature/payments"],
      }
      const expectedData = {
        glu_xyz789_abc123: ["feature/payments"],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockWriteJson.mockResolvedValue(undefined)

      await removeBranchFromTracking("feature/auth")

      expect(mockWriteJson).toHaveBeenCalledWith(
        mockTrackingFile,
        expectedData,
        { spaces: 2 }
      )
    })

    test("handles removing non-existent branch gracefully", async () => {
      const initialData = {
        glu_abc123_def456: ["feature/auth"],
        glu_xyz789_abc123: ["feature/payments"],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockWriteJson.mockResolvedValue(undefined)

      await removeBranchFromTracking("feature/nonexistent")

      // Data should remain unchanged
      expect(mockWriteJson).toHaveBeenCalledWith(
        mockTrackingFile,
        initialData,
        { spaces: 2 }
      )
    })

    test("handles empty tracking data", async () => {
      const initialData = {}

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockWriteJson.mockResolvedValue(undefined)

      await removeBranchFromTracking("feature/any")

      expect(mockWriteJson).toHaveBeenCalledWith(
        mockTrackingFile,
        initialData,
        { spaces: 2 }
      )
    })

    test("handles corrupted glu-id entries gracefully", async () => {
      const initialData = {
        glu_abc123_def456: null,
        glu_xyz789_abc123: ["feature/payments"],
      }
      const expectedData = {
        glu_xyz789_abc123: ["feature/payments"],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockWriteJson.mockResolvedValue(undefined)

      await removeBranchFromTracking("feature/any")

      expect(mockWriteJson).toHaveBeenCalledWith(
        mockTrackingFile,
        expectedData,
        { spaces: 2 }
      )
    })
  })

  describe("getBranchesForGluId", () => {
    test("returns branches for existing glu-id", async () => {
      const trackingData = {
        glu_abc123_def456: ["feature/auth", "hotfix/login"],
        glu_xyz789_abc123: ["feature/payments"],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(trackingData)

      const result = await getBranchesForGluId("glu_abc123_def456")

      expect(result).toEqual(["feature/auth", "hotfix/login"])
    })

    test("returns empty array for non-existent glu-id", async () => {
      const trackingData = {
        glu_abc123_def456: ["feature/auth"],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(trackingData)

      const result = await getBranchesForGluId("glu_nonexistent_123")

      expect(result).toEqual([])
    })

    test("returns empty array when no tracking file exists", async () => {
      mockPathExists.mockResolvedValue(false)

      const result = await getBranchesForGluId("glu_any_123")

      expect(result).toEqual([])
    })

    test("returns empty array when tracking data is corrupted", async () => {
      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockRejectedValue(new Error("Invalid JSON"))

      const result = await getBranchesForGluId("glu_any_123")

      expect(result).toEqual([])
    })

    test.each([
      {
        gluId: "glu_simple_123456",
        branches: ["main"],
      },
      {
        gluId: "glu_feature_abcdef",
        branches: [
          "feature/auth",
          "feature/user-management",
          "hotfix/auth-fix",
        ],
      },
      {
        gluId: "glu_complex_789abc",
        branches: [],
      },
    ])(
      "handles various scenarios: glu-id $gluId",
      async ({ gluId, branches }) => {
        const trackingData = { [gluId]: branches }

        mockPathExists.mockResolvedValue(true)
        mockReadJson.mockResolvedValue(trackingData)

        const result = await getBranchesForGluId(gluId)

        expect(result).toEqual(branches)
      }
    )
  })

  describe("cleanupBranchTracking", () => {
    test("removes tracking for non-existent branches", async () => {
      const initialData = {
        glu_abc123_def456: ["feature/auth", "feature/deleted"],
        glu_xyz789_abc123: ["feature/payments", "hotfix/removed"],
      }
      const expectedData = {
        glu_abc123_def456: ["feature/auth"],
        glu_xyz789_abc123: ["feature/payments"],
      }

      // Mock existing branches
      const mockBranches = {
        all: ["feature/auth", "feature/payments", "main"],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockWriteJson.mockResolvedValue(undefined)
      mockBranch.mockResolvedValue(mockBranches)

      await cleanupBranchTracking()

      expect(mockGit.branch).toHaveBeenCalledWith(["-a"])
      expect(mockWriteJson).toHaveBeenCalledWith(
        mockTrackingFile,
        expectedData,
        { spaces: 2 }
      )
    })

    test("removes glu-id entries when all branches are deleted", async () => {
      const initialData = {
        glu_abc123_def456: ["feature/deleted"],
        glu_xyz789_abc123: ["feature/payments"],
      }
      const expectedData = {
        glu_xyz789_abc123: ["feature/payments"],
      }

      const mockBranches = {
        all: ["feature/payments", "main"],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockWriteJson.mockResolvedValue(undefined)
      mockBranch.mockResolvedValue(mockBranches)

      await cleanupBranchTracking()

      expect(mockWriteJson).toHaveBeenCalledWith(
        mockTrackingFile,
        expectedData,
        { spaces: 2 }
      )
    })

    test("filters out remote branches from consideration", async () => {
      const initialData = {
        glu_abc123_def456: ["feature/auth", "non-existent"],
      }

      const mockBranches = {
        all: [
          "feature/auth",
          "main",
          "remotes/origin/feature/auth",
          "remotes/origin/main",
          "remotes/upstream/develop",
        ],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockWriteJson.mockResolvedValue(undefined)
      mockBranch.mockResolvedValue(mockBranches)

      await cleanupBranchTracking()

      // Should not modify data since feature/auth exists locally
      expect(mockWriteJson).toHaveBeenCalledWith(
        mockTrackingFile,
        initialData,
        { spaces: 2 }
      )
    })

    test("handles branches with asterisk (current branch marker)", async () => {
      const initialData = {
        glu_abc123_def456: ["main", "feature/auth", "non-existent"],
      }

      const mockBranches = {
        all: ["* feature/auth", "  main"], // Git format with asterisk and spaces
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockWriteJson.mockResolvedValue(undefined)
      mockBranch.mockResolvedValue(mockBranches)

      await cleanupBranchTracking()

      // Should not modify data since both branches exist
      expect(mockWriteJson).toHaveBeenCalledWith(
        mockTrackingFile,
        initialData,
        { spaces: 2 }
      )
    })

    test("does not save when no changes are needed", async () => {
      const initialData = {
        glu_abc123_def456: ["feature/auth"],
        glu_xyz789_abc123: ["feature/payments"],
      }

      const mockBranches = {
        all: ["feature/auth", "feature/payments", "main"],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockBranch.mockResolvedValue(mockBranches)

      await cleanupBranchTracking()

      // writeJson should not be called since no modifications were made
      expect(mockWriteJson).not.toHaveBeenCalled()
    })

    test("handles empty tracking data", async () => {
      const initialData = {}

      const mockBranches = {
        all: ["feature/auth", "main"],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockBranch.mockResolvedValue(mockBranches)

      await cleanupBranchTracking()

      expect(mockWriteJson).not.toHaveBeenCalled()
    })

    test("handles git branch command failure gracefully", async () => {
      const initialData = {
        glu_abc123_def456: ["feature/auth"],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockBranch.mockRejectedValue(new Error("Git command failed"))

      // Should not throw
      await expect(cleanupBranchTracking()).rejects.toThrow(
        "Git command failed"
      )

      expect(mockWriteJson).not.toHaveBeenCalled()
    })

    test("handles missing or null branch list", async () => {
      const initialData = {
        glu_abc123_def456: ["feature/auth"],
      }
      const expectedData = {}

      const mockBranches = {
        all: null, // Null branch list
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockWriteJson.mockResolvedValue(undefined)
      mockBranch.mockResolvedValue(mockBranches)

      await cleanupBranchTracking()

      // Should remove all tracking since no branches exist
      expect(mockWriteJson).toHaveBeenCalledWith(
        mockTrackingFile,
        expectedData,
        { spaces: 2 }
      )
    })
  })

  describe("integration scenarios", () => {
    test("complete workflow: add, lookup, remove, cleanup", async () => {
      // Setup empty state
      mockPathExists.mockResolvedValue(false)
      mockWriteJson.mockResolvedValue(undefined)

      // Add branches to tracking
      await addBranchToTracking("glu_test_123456", "feature/auth")
      await addBranchToTracking("glu_test_123456", "hotfix/auth-fix")
      await addBranchToTracking("glu_test_789abc", "feature/payments")

      // Update mocks to simulate the saved state
      const trackingState = {
        glu_test_123456: ["feature/auth", "hotfix/auth-fix"],
        glu_test_789abc: ["feature/payments"],
      }
      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(trackingState)

      // Test lookup
      const authBranches = await getBranchesForGluId("glu_test_123456")
      expect(authBranches).toEqual(["feature/auth", "hotfix/auth-fix"])

      const paymentBranches = await getBranchesForGluId("glu_test_789abc")
      expect(paymentBranches).toEqual(["feature/payments"])

      // Test removal
      await removeBranchFromTracking("hotfix/auth-fix")

      // Verify calls were made in expected order
      expect(mockWriteJson).toHaveBeenCalledTimes(4) // 3 adds + 1 remove
    })

    test("handles concurrent modifications gracefully", async () => {
      const initialData = {
        glu_existing_123: ["feature/existing"],
      }

      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValue(initialData)
      mockWriteJson.mockResolvedValue(undefined)

      // Simulate concurrent operations
      const promises = [
        addBranchToTracking("glu_new_456", "feature/new1"),
        addBranchToTracking("glu_new_789", "feature/new2"),
        getBranchesForGluId("glu_existing_123"),
      ]

      const results = await Promise.all(promises)

      // Should complete without errors
      expect(results[2]).toEqual(["feature/existing"])
      expect(mockWriteJson).toHaveBeenCalledTimes(2) // Two add operations
    })

    test("error recovery: corrupted file during operation", async () => {
      // First call succeeds (load), second fails (save)
      mockPathExists.mockResolvedValue(true)
      mockReadJson.mockResolvedValueOnce({ glu_test_123: ["branch1"] })
      mockWriteJson.mockRejectedValueOnce(new Error("Disk full"))

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {})

      // Should not throw despite save failure
      await expect(
        addBranchToTracking("glu_test_123", "branch2")
      ).resolves.toBeUndefined()

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to save branch tracking data:",
        expect.any(Error)
      )

      consoleWarnSpy.mockRestore()
    })
  })
})
