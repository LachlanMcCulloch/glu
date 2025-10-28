import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { execa } from "execa"
import { simpleGit } from "simple-git"
import path from "path"
import { GitFixture } from "@tests/helpers/git-fixture.ts"
import type { TestRepo } from "@tests/helpers/test-types.ts"

describe("glu ls", () => {
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

  test("shows error when no origin remote", async () => {
    repo = await gitFixture.createNoOriginRepo()

    const result = await execa("node", [gluPath, "ls"], {
      cwd: repo.path,
      reject: false,
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("❌ No remote 'origin' configured")
  })

  test("shows commits ahead of origin with tracking info", async () => {
    repo = await gitFixture.createBasicStack()

    const result = await execa("node", [gluPath, "ls"], {
      cwd: repo.path,
      reject: false,
    })

    expect(result.exitCode).toBe(0)

    const git = simpleGit(repo.path)
    const log = await git.log()
    const commits = log.all

    const lines = result.stdout.split("\n").filter(Boolean)
    expect(lines[0]).toEqual("feature-branch → origin/feature-branch [↑2 ↓0]")

    // Assess structure of lines
    expect(lines[1]).toMatch(/^\s+2\s+[a-f0-9]{7}\s+.+$/)
    expect(lines[2]).toMatch(/^\s+1\s+[a-f0-9]{7}\s+.+$/)

    // Assess line content accurracy
    expect(lines[1]).toContain(commits[0]?.message) // newest commit
    expect(lines[1]).toContain(commits[0]?.hash.substring(0, 7))
    expect(lines[2]).toContain(commits[1]?.message) // older commit
    expect(lines[2]).toContain(commits[1]?.hash.substring(0, 7))
  })

  test("Shows only current commits and not commits that are only remote", async () => {
    repo = await gitFixture.createAheadBehindScenario()

    const result = await execa("node", [gluPath, "ls"], {
      cwd: repo.path,
      reject: false,
    })
    expect(result.exitCode).toBe(0)

    const git = simpleGit(repo.path)
    const log = await git.log()
    const commits = log.all

    const lines = result.stdout.split("\n").filter(Boolean)
    expect(lines[0]).toEqual("feature-branch → origin/feature-branch [↑2 ↓2]")

    // Assess structure of lines
    expect(lines[1]).toMatch(/^\s+2\s+[a-f0-9]{7}\s+.+$/)
    expect(lines[2]).toMatch(/^\s+1\s+[a-f0-9]{7}\s+.+$/)

    // Assess line content accurracy
    expect(lines[1]).toContain(commits[0]?.message) // newest commit
    expect(lines[1]).toContain(commits[0]?.hash.substring(0, 7))
    expect(lines[2]).toContain(commits[1]?.message) // older commit
    expect(lines[2]).toContain(commits[1]?.hash.substring(0, 7))
  })

  test("shows branch tracking information", async () => {
    // Setup: Create stack and review branches
    repo = await gitFixture.createBasicStack()
    const git = simpleGit(repo.path)

    // Create review branch using glu (simulate real usage)
    await execa("node", [gluPath, "request-review", "1", "--no-push"], {
      cwd: repo.path,
    })

    // Run glu ls
    const result = await execa("node", [gluPath, "ls"], {
      cwd: repo.path,
      reject: false,
    })

    expect(result.exitCode).toBe(0)

    const lines = result.stdout.split("\n").filter(Boolean)
    console.log(lines)

    expect(lines[1]).toMatch(/2\s+[a-f0-9]{7}\s+Fix feature A/)
    expect(lines[2]).toMatch(/1\s+[a-f0-9]{7}\s+Add feature B ● .+/)
  })

  test("does not show duplicate branches when expanding review range", async () => {
    repo = await gitFixture.createBasicStack()

    // Create first review branch with commits 1-2
    await execa("node", [gluPath, "rr", "1-2", "--no-push"], {
      cwd: repo.path,
    })

    // Add another commit
    const git = simpleGit(repo.path)
    // await git.checkout("feature-branch")
    const fs = await import("fs-extra")
    const path = await import("path")
    await fs.writeFile(
      path.join(repo.path, "feature-c.js"),
      'export const featureC = () => "C";\n'
    )
    await git.add(".")
    await git.commit("Add feature C")

    // Create second review branch with expanded range 1-3
    await execa("node", [gluPath, "rr", "1-3", "--no-push"], {
      cwd: repo.path,
    })

    // Check glu ls output
    const result = await execa("node", [gluPath, "ls"], {
      cwd: repo.path,
    })
    expect(result.exitCode).toBe(0)

    const lines = result.stdout.split("\n").filter(Boolean)

    // Each commit line should not have the same branch name listed multiple times
    for (const line of lines) {
      // Skip header
      if (line.includes("→")) continue

      // Count occurrences of "review/" in each line
      // Each commit should have each branch listed at most once
      const reviewMatches = line.match(/review\/[^\s,]+/g)
      if (reviewMatches && reviewMatches.length > 1) {
        // Check for duplicates
        const uniqueBranches = new Set(reviewMatches)
        expect(uniqueBranches.size).toBe(reviewMatches.length)
      }
    }
  })
})
