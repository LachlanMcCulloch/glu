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
    expect(result.stderr).toContain(
      "No origin branch found for master. Push the branch first or there are no commits to compare."
    )
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
})
