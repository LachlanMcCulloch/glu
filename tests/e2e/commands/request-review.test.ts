import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { execa } from "execa"
import { simpleGit } from "simple-git"
import path from "path"
import fs from "fs-extra"
import { GitFixture } from "@tests/helpers/git-fixture.ts"
import type { TestRepo } from "@tests/helpers/test-types.ts"
import type { GraphData } from "@/infrastructure/graph-storage-adapter.ts"

describe("glu request-review (rr)", () => {
  let gitFixture: GitFixture
  let repo: TestRepo | undefined
  let gluPath: string

  beforeEach(async () => {
    gitFixture = new GitFixture()
    gluPath = path.resolve(process.cwd(), "dist/index.js")
  })

  afterEach(async () => {
    await repo?.cleanup()
    await gitFixture.cleanup()
  })

  describe("basic functionality", () => {
    test("creates review branch with glu IDs", async () => {
      repo = await gitFixture.createBasicStack()

      const result = await execa("node", [gluPath, "rr", "1", "--no-push"], {
        cwd: repo.path,
        reject: false,
      })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("created locally")

      // Verify glu IDs were injected
      const git = simpleGit(repo.path)
      const log = await git.log()

      // Check commits have glu IDs
      expect(log.all[0]?.body).toMatch(/Glu-ID: glu_/)
    })

    test("preserves existing glu IDs", async () => {
      repo = await gitFixture.createStackWithGluIds({
        withGluIds: [false, true, true, true],
      })

      const git = simpleGit(repo.path)
      const logBefore = await git.log()
      const gluIdBefore = logBefore.all[0]?.body.match(/Glu-ID: (glu_\w+)/)?.[1]

      const result = await execa("node", [gluPath, "rr", "1", "--no-push"], {
        cwd: repo.path,
        reject: false,
      })

      expect(result.exitCode).toBe(0)

      // Verify glu ID preserved
      const logAfter = await git.log()
      const gluIdAfter = logAfter.all[0]?.body.match(/Glu-ID: (glu_\w+)/)?.[1]

      expect(gluIdAfter).toBe(gluIdBefore)
    })
  })

  describe("graph tracking", () => {
    test("creates .git/glu/graph.json file", async () => {
      repo = await gitFixture.createBasicStack()

      await execa("node", [gluPath, "rr", "1", "--no-push"], {
        cwd: repo.path,
      })

      const graphPath = path.join(repo.path, ".git", "glu", "graph.json")
      expect(await fs.pathExists(graphPath)).toBe(true)

      const graphData = await fs.readJson(graphPath)
      expect(graphData.version).toBe("1.0.0")
      expect(Object.keys(graphData.commits).length).toBeGreaterThan(0)
    })

    test("tracks commits across multiple review branches", async () => {
      repo = await gitFixture.createBasicStack()

      // Create first review branch
      await execa(
        "node",
        [gluPath, "rr", "1", "-b", "review/first", "--no-push"],
        {
          cwd: repo.path,
        }
      )

      // Create second review branch with overlapping commits
      await execa(
        "node",
        [gluPath, "rr", "1-2", "-b", "review/second", "--no-push"],
        {
          cwd: repo.path,
        }
      )

      const graphPath = path.join(repo.path, ".git", "glu", "graph.json")
      const graphData = (await fs.readJson(graphPath)) as GraphData

      // First commit should appear in both branches
      const firstCommitGluId = Object.keys(graphData.commits)[0]!
      const locations = graphData.commits[firstCommitGluId]!.locations

      expect(locations.length).toBe(2)
      expect(locations.map((l) => l.branch)).toContain("review/first")
      expect(locations.map((l) => l.branch)).toContain("review/second")
    })
  })

  describe("integration with glu ls", () => {
    test("shows branch tracking in ls output", async () => {
      repo = await gitFixture.createBasicStack()

      // Create review branch
      await execa(
        "node",
        [gluPath, "rr", "1", "-b", "review/test", "--no-push"],
        {
          cwd: repo.path,
        }
      )

      // Run glu ls
      const result = await execa("node", [gluPath, "ls"], {
        cwd: repo.path,
      })

      expect(result.exitCode).toBe(0)
      // Should show branch tracking indicator
      expect(result.stdout).toMatch(/review\/test/)
    })
  })

  describe("error handling", () => {
    test("fails gracefully on dirty working directory", async () => {
      repo = await gitFixture.createBasicStack()

      // Create dirty file
      await fs.writeFile(
        path.join(repo.path, "dirty.txt"),
        "uncommitted changes"
      )

      const result = await execa("node", [gluPath, "rr", "1"], {
        cwd: repo.path,
        reject: false,
      })

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toMatch(/Working directory is not clean/i)
    })

    test("handles invalid range", async () => {
      repo = await gitFixture.createBasicStack()

      const result = await execa("node", [gluPath, "rr", "1-100"], {
        cwd: repo.path,
        reject: false,
      })

      expect(result.exitCode).toBe(2)
      expect(result.stderr).toMatch(/out of range/i)
    })
  })
})
