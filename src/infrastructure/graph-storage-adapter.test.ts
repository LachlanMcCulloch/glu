import path from "path"
import fs from "fs/promises"
import {
  FileSystemGraphStorage,
  type GraphData,
} from "./graph-storage-adapter.js"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const TEST_DIR = path.join(process.cwd(), ".test-graph-storage")

describe("FileSystemGraphStorage", () => {
  let storage: FileSystemGraphStorage

  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true })
    storage = new FileSystemGraphStorage(TEST_DIR)
  })

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true })
  })

  describe("initialize", () => {
    it("creates empty graph with correct storage", async () => {
      const graph = await storage.initialize()

      expect(graph.version).toBe("1.0.0")
      expect(graph.commits).toEqual({})
    })

    it("creates .glu directory", async () => {
      await storage.initialize()

      const gluDir = path.join(TEST_DIR, ".glu")
      const stats = await fs.stat(gluDir)
      expect(stats.isDirectory()).toBe(true)
    })

    it("creates graph.json file", async () => {
      await storage.initialize()

      const exists = await storage.exists()
      expect(exists).toBe(true)
    })
  })

  describe("exists", () => {
    it("returns false when graph does not exist", async () => {
      const exists = await storage.exists()
      expect(exists).toBe(false)
    })

    it("returns true when graph exists", async () => {
      await storage.initialize()
      const exists = await storage.exists()
      expect(exists).toBe(true)
    })
  })

  describe("save and load", () => {
    it("round-trips data correctly", async () => {
      const testData: GraphData = {
        version: "1.0.0",
        commits: {
          glu_test_123: {
            firstSeen: "2025-01-13T10:00:00Z",
            locations: [
              {
                branch: "main",
                commitHash: "abc123",
                status: "unpushed",
              },
            ],
          },
        },
      }

      await storage.save(testData)
      const loaded = await storage.load()

      expect(loaded).toEqual(testData)
    })

    it("preserves multiple commits", async () => {
      const testData: GraphData = {
        version: "1.0.0",
        commits: {
          glu_test_123: {
            firstSeen: "2025-01-13T10:00:00Z",
            locations: [
              {
                branch: "main",
                commitHash: "abc123",
                status: "unpushed",
              },
            ],
          },
          glu_test_456: {
            firstSeen: "2025-01-13T11:00:00Z",
            locations: [
              {
                branch: "review/feature",
                commitHash: "def456",
                status: "pushed",
                remote: "origin",
                pushedAt: "2025-01-13T12:00:00Z",
              },
            ],
          },
        },
      }

      await storage.save(testData)
      const loaded = await storage.load()

      expect(Object.keys(loaded.commits)).toHaveLength(2)
      expect(loaded.commits["glu_test_123"]).toBeDefined()
      expect(loaded.commits["glu_test_456"]).toBeDefined()
    })

    it("preserves multiple locations for same commit", async () => {
      const testData: GraphData = {
        version: "1.0.0",
        commits: {
          glu_test_123: {
            firstSeen: "2025-01-13T10:00:00Z",
            locations: [
              {
                branch: "main",
                commitHash: "abc123",
                status: "unpushed",
              },
              {
                branch: "review/feature-a",
                commitHash: "xyz789",
                status: "pushed",
                remote: "origin",
                pushedAt: "2025-01-13T11:00:00Z",
              },
              {
                branch: "review/feature-b",
                commitHash: "def456",
                status: "pushed",
                remote: "origin",
                pushedAt: "2025-01-13T12:00:00Z",
              },
            ],
          },
        },
      }

      await storage.save(testData)
      const loaded = await storage.load()

      expect(loaded.commits["glu_test_123"]?.locations).toHaveLength(3)
    })
  })

  describe("error handling", () => {
    it("initializes fresh graph on corrupted data", async () => {
      const gluDir = path.join(TEST_DIR, ".glu")
      await fs.mkdir(gluDir, { recursive: true })
      await fs.writeFile(
        path.join(gluDir, "graph.json"),
        "{ invalid json",
        "utf-8"
      )

      const loaded = await storage.load()

      expect(loaded.version).toBe("1.0.0")
      expect(loaded.commits).toEqual({})
    })

    it("initializes fresh graph on missing file", async () => {
      const loaded = await storage.load()

      expect(loaded.version).toBe("1.0.0")
      expect(loaded.commits).toEqual({})
    })

    it("creates backup of corrupted file", async () => {
      const gluDir = path.join(TEST_DIR, ".glu")
      await fs.mkdir(gluDir, { recursive: true })
      const graphPath = path.join(gluDir, "graph.json")
      await fs.writeFile(graphPath, "{ invalid json", "utf-8")

      await storage.load()

      const files = await fs.readdir(gluDir)
      const backupFiles = files.filter((f) => f.startsWith("graph.json.backup"))
      expect(backupFiles.length).toBeGreaterThan(0)
    })
  })

  describe("concurrent operations", () => {
    it("handles multiple saves", async () => {
      const data1: GraphData = {
        version: "1.0.0",
        commits: {
          glu_1: {
            firstSeen: "2025-01-13T10:00:00Z",
            locations: [
              { branch: "main", commitHash: "abc", status: "unpushed" },
            ],
          },
        },
      }

      const data2: GraphData = {
        version: "1.0.0",
        commits: {
          glu_2: {
            firstSeen: "2025-01-13T11:00:00Z",
            locations: [
              { branch: "main", commitHash: "def", status: "unpushed" },
            ],
          },
        },
      }

      await storage.save(data1)
      await storage.save(data2)

      const loaded = await storage.load()
      expect(loaded.commits["glu_2"]).toBeDefined()
    })
  })
})
