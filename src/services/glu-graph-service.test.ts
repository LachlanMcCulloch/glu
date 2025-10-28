import { describe, it, expect, beforeEach } from "vitest"
import { GluGraphService } from "./glu-graph-service.js"
import type {
  GraphData,
  GraphStorageAdapter,
} from "../infrastructure/graph-storage-adapter.js"

class InMemoryGraphStorage implements GraphStorageAdapter {
  private data: GraphData = {
    version: "1.0.0",
    commits: {},
  }

  async load(): Promise<GraphData> {
    return JSON.parse(JSON.stringify(this.data))
  }

  async save(data: GraphData): Promise<void> {
    this.data = JSON.parse(JSON.stringify(data))
  }

  async exists(): Promise<boolean> {
    return true
  }

  async initialize(): Promise<GraphData> {
    this.data = {
      version: "1.0.0",
      commits: {},
    }
    return this.load()
  }
}

describe("GluGraphService", () => {
  let service: GluGraphService
  let storage: InMemoryGraphStorage

  beforeEach(() => {
    storage = new InMemoryGraphStorage()
    service = new GluGraphService(storage)
  })

  describe("recordCommitLocation", () => {
    it("records new commit location", async () => {
      await service.recordCommitLocation("glu_123", "main", "abc123")

      const data = await storage.load()
      expect(data.commits["glu_123"]).toBeDefined()
      expect(data.commits["glu_123"]?.locations).toHaveLength(1)
      expect(data.commits["glu_123"]?.locations[0]).toMatchObject({
        branch: "main",
        commitHash: "abc123",
        status: "unpushed",
      })
    })

    it("sets firstSeen timestamp on new commit", async () => {
      const before = new Date().getTime()
      await service.recordCommitLocation("glu_123", "main", "abc123")
      const after = new Date().getTime()

      const data = await storage.load()
      const firstSeen = new Date(data.commits["glu_123"]!.firstSeen).getTime()

      expect(firstSeen).toBeGreaterThanOrEqual(before)
      expect(firstSeen).toBeLessThanOrEqual(after)
    })

    it("appends location to existing commit", async () => {
      await service.recordCommitLocation("glu_123", "main", "abc123")
      await service.recordCommitLocation("glu_123", "review/feature", "def456")

      const data = await storage.load()
      expect(data.commits["glu_123"]?.locations).toHaveLength(2)
    })

    it("does not duplicate same location", async () => {
      await service.recordCommitLocation("glu_123", "main", "abc123")
      await service.recordCommitLocation("glu_123", "main", "abc123")

      const data = await storage.load()
      expect(data.commits["glu_123"]?.locations).toHaveLength(1)
    })

    it("allows same branch with different commit hash", async () => {
      await service.recordCommitLocation("glu_123", "main", "abc123")
      await service.recordCommitLocation("glu_123", "main", "def456")

      const data = await storage.load()
      expect(data.commits["glu_123"]?.locations).toHaveLength(1)
    })
  })

  describe("markBranchPushed", () => {
    beforeEach(async () => {
      await service.recordCommitLocation("glu_123", "review/feature", "abc123")
      await service.recordCommitLocation("glu_456", "review/feature", "def456")
      await service.recordCommitLocation("glu_123", "main", "xyz789")
    })

    it("marks all commits on branch as pushed", async () => {
      await service.markBranchPushed("review/feature", "origin")

      const data = await storage.load()

      expect(
        data.commits["glu_123"]?.locations.find(
          (l) => l.branch === "review/feature"
        )?.status
      ).toBe("pushed")

      expect(
        data.commits["glu_456"]?.locations.find(
          (l) => l.branch === "review/feature"
        )?.status
      ).toBe("pushed")
    })

    it("does not affect other branches", async () => {
      await service.markBranchPushed("review/feature", "origin")

      const data = await storage.load()
      const mainLocation = data.commits["glu_123"]?.locations.find(
        (l) => l.branch === "main"
      )

      expect(mainLocation?.status).toBe("unpushed")
    })

    it("sets remote name", async () => {
      await service.markBranchPushed("review/feature", "origin")

      const data = await storage.load()
      const location = data.commits["glu_123"]?.locations.find(
        (l) => l.branch === "review/feature"
      )

      expect(location?.remote).toBe("origin")
    })

    it("sets pushedAt timestamp", async () => {
      const before = new Date().getTime()
      await service.markBranchPushed("review/feature", "origin")
      const after = new Date().getTime()

      const data = await storage.load()
      const location = data.commits["glu_123"]?.locations.find(
        (l) => l.branch === "review/feature"
      )

      expect(location?.pushedAt).toBeDefined()
      const pushedAt = new Date(location!.pushedAt!).getTime()
      expect(pushedAt).toBeGreaterThanOrEqual(before)
      expect(pushedAt).toBeLessThanOrEqual(after)
    })

    it("uses custom timestamp when provided", async () => {
      const customTime = new Date("2025-01-13T12:00:00Z")
      await service.markBranchPushed("review/feature", "origin", customTime)

      const data = await storage.load()
      const location = data.commits["glu_123"]?.locations.find(
        (l) => l.branch === "review/feature"
      )

      expect(location?.pushedAt).toBe("2025-01-13T12:00:00.000Z")
    })
  })

  describe("getBranchesForGluId", () => {
    it("returns empty array for unknown glu ID", async () => {
      const branches = await service.getBranchesForGluId("glu_unknown")
      expect(branches).toEqual([])
    })

    it("returns all branches for glu ID", async () => {
      await service.recordCommitLocation("glu_123", "main", "abc123")
      await service.recordCommitLocation("glu_123", "review/a", "def456")
      await service.recordCommitLocation("glu_123", "review/b", "ghi789")

      const branches = await service.getBranchesForGluId("glu_123")

      expect(branches).toHaveLength(3)
      expect(branches.map((b) => b.branch)).toEqual([
        "main",
        "review/a",
        "review/b",
      ])
    })

    it("includes pushed status", async () => {
      await service.recordCommitLocation("glu_123", "review/feature", "abc123")
      await service.markBranchPushed("review/feature", "origin")

      const branches = await service.getBranchesForGluId("glu_123")

      expect(branches[0]?.status).toBe("pushed")
      expect(branches[0]?.remote).toBe("origin")
    })

    it("converts pushedAt string to Date", async () => {
      await service.recordCommitLocation("glu_123", "review/feature", "abc123")
      await service.markBranchPushed("review/feature", "origin")

      const branches = await service.getBranchesForGluId("glu_123")

      expect(branches[0]?.pushedAt).toBeInstanceOf(Date)
    })
  })

  describe("getGluIdsOnBranch", () => {
    beforeEach(async () => {
      await service.recordCommitLocation("glu_123", "main", "abc123")
      await service.recordCommitLocation("glu_123", "review/a", "def456")
      await service.recordCommitLocation("glu_456", "review/a", "ghi789")
      await service.recordCommitLocation("glu_789", "review/b", "jkl012")
    })

    it("returns all glu IDs on specific branch", async () => {
      const gluIds = await service.getGluIdsOnBranch("review/a")

      expect(gluIds).toHaveLength(2)
      expect(gluIds).toContain("glu_123")
      expect(gluIds).toContain("glu_456")
    })

    it("returns empty array for branch with no commits", async () => {
      const gluIds = await service.getGluIdsOnBranch("nonexistent")
      expect(gluIds).toEqual([])
    })

    it("returns single commit on branch", async () => {
      const gluIds = await service.getGluIdsOnBranch("main")

      expect(gluIds).toHaveLength(1)
      expect(gluIds).toContain("glu_123")
    })
  })

  describe("getAllTrackedCommits", () => {
    it("returns empty map when no commits tracked", async () => {
      const commits = await service.getAllTrackedCommits()
      expect(commits.size).toBe(0)
    })

    it("returns all tracked commits", async () => {
      await service.recordCommitLocation("glu_123", "main", "abc123")
      await service.recordCommitLocation("glu_456", "review/a", "def456")

      const commits = await service.getAllTrackedCommits()

      expect(commits.size).toBe(2)
      expect(commits.has("glu_123")).toBe(true)
      expect(commits.has("glu_456")).toBe(true)
    })

    it("includes all tracking data", async () => {
      await service.recordCommitLocation("glu_123", "main", "abc123")
      await service.recordCommitLocation("glu_123", "review/a", "def456")

      const commits = await service.getAllTrackedCommits()
      const commit = commits.get("glu_123")

      expect(commit).toBeDefined()
      expect(commit?.gluId).toBe("glu_123")
      expect(commit?.firstSeen).toBeInstanceOf(Date)
      expect(commit?.locations).toHaveLength(2)
    })
  })

  describe("pruneDeletedBranches", () => {
    beforeEach(async () => {
      await service.recordCommitLocation("glu_123", "main", "abc123")
      await service.recordCommitLocation("glu_123", "review/a", "def456")
      await service.recordCommitLocation("glu_456", "review/b", "ghi789")
      await service.recordCommitLocation("glu_789", "review/c", "jkl012")
    })

    it("removes locations for deleted branches", async () => {
      const pruned = await service.pruneDeletedBranches(["main", "review/a"])

      expect(pruned).toBe(2)

      const data = await storage.load()
      expect(data.commits["glu_123"]?.locations).toHaveLength(2)
      expect(data.commits["glu_456"]).toBeUndefined()
      expect(data.commits["glu_789"]).toBeUndefined()
    })

    it("removes commits with no remaining locations", async () => {
      await service.pruneDeletedBranches(["main"])

      const data = await storage.load()
      expect(data.commits["glu_456"]).toBeUndefined()
      expect(data.commits["glu_789"]).toBeUndefined()
      expect(data.commits["glu_123"]).toBeDefined()
    })

    it("returns count of pruned locations", async () => {
      const pruned = await service.pruneDeletedBranches([])

      expect(pruned).toBe(4)
    })

    it("handles empty existing branches", async () => {
      const pruned = await service.pruneDeletedBranches([])

      const data = await storage.load()
      expect(Object.keys(data.commits)).toHaveLength(0)
    })

    it("keeps all locations when all branches exist", async () => {
      const pruned = await service.pruneDeletedBranches([
        "main",
        "review/a",
        "review/b",
        "review/c",
      ])

      expect(pruned).toBe(0)

      const data = await storage.load()
      expect(Object.keys(data.commits)).toHaveLength(3)
    })
  })

  describe("export and import", () => {
    it("exports graph data", async () => {
      await service.recordCommitLocation("glu_123", "main", "abc123")

      const exported = await service.export()

      expect(exported.version).toBe("1.0.0")
      expect(exported.commits["glu_123"]).toBeDefined()
    })

    it("imports graph data", async () => {
      const importData: GraphData = {
        version: "1.0.0",
        commits: {
          glu_imported: {
            firstSeen: "2025-01-13T10:00:00Z",
            locations: [
              {
                branch: "imported-branch",
                commitHash: "imported123",
                status: "pushed",
                remote: "origin",
              },
            ],
          },
        },
      }

      await service.import(importData)

      const branches = await service.getBranchesForGluId("glu_imported")
      expect(branches).toHaveLength(1)
      expect(branches[0]?.branch).toBe("imported-branch")
    })
  })
})
