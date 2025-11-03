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

  test("shows commits on new branch tracking remote", async () => {
    repo = await gitFixture.createScenario({
      name: "Up to date stack",
      commits: [
        { message: "Initial commit", files: { "README.md": "# Test\n" } },
        {
          message: "Feature 1",
          files: { "feature1.js": "console.log('f1');\n" },
        },
        {
          message: "Feature 2",
          files: { "feature2.js": "console.log('f2');\n" },
        },
      ],
      originAt: 2, // Origin points to the last commit (Feature 2)
      currentBranch: "main",
    })

    const initialResult = await execa("node", [gluPath, "ls"], {
      cwd: repo.path,
      reject: false,
    })
    expect(initialResult.exitCode).toBe(0)
    expect(initialResult.stdout).toContain(
      "No commits found ahead of origin/main"
    )

    // Create a new branch tracking the remote branch (like git checkout -b test origin/main)
    const git = simpleGit(repo.path)
    await git.checkoutBranch("test", "origin/main")

    // Add a new commit on this new branch
    const fs = await import("fs-extra")
    const path = await import("path")
    await fs.writeFile(
      path.join(repo.path, "new-feature.js"),
      'console.log("new feature");\n'
    )
    await git.add(".")
    await git.commit("Add new feature")

    // Run glu ls and verify the output
    const result = await execa("node", [gluPath, "ls"], {
      cwd: repo.path,
      reject: false,
    })

    console.log(result)
    expect(result.exitCode).toBe(0)

    const lines = result.stdout.split("\n").filter(Boolean)

    // Should show test branch tracking origin/main with 1 commit ahead
    expect(lines[0]).toEqual("test → origin/main [↑1 ↓0]")

    // Should show the new commit at index 1
    expect(lines[1]).toMatch(/^\s+1\s+[a-f0-9]{7}\s+Add new feature$/)
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

      if (line.includes("●")) {
        const branchSection = line.split("●")[1]?.trim()
        if (branchSection) {
          const branches = branchSection
            .split(",")
            .map((b) => b.trim())
            .filter(Boolean)

          console.log(branches)
          const uniqueBranches = new Set(branches)
          expect(uniqueBranches.size).toBe(branches.length)
        } else {
          expect.fail(`unexpected format ${line}`)
        }
      }
    }
  })

  test("does not show deleted branches in tracking info", async () => {
    repo = await gitFixture.createBasicStack()
    const git = simpleGit(repo.path)

    // Create two review branches using glu
    await execa("node", [gluPath, "rr", "1", "--no-push"], {
      cwd: repo.path,
    })

    await execa("node", [gluPath, "rr", "2", "--no-push"], {
      cwd: repo.path,
    })

    // Get all branches to find the review branches
    const branchesBefore = await git.branch()
    const reviewBranches = Object.keys(branchesBefore.branches).filter(
      (b) => b !== "feature-branch" && !b.startsWith("remotes/")
    )

    // Verify we have review branches
    expect(reviewBranches.length).toBeGreaterThan(0)

    // First glu ls should show the review branches
    const resultBefore = await execa("node", [gluPath, "ls"], {
      cwd: repo.path,
      reject: false,
    })

    expect(resultBefore.exitCode).toBe(0)
    const linesBefore = resultBefore.stdout.split("\n").filter(Boolean)

    // Find lines with tracking info (containing ●)
    const linesWithTracking = linesBefore.filter((line) => line.includes("●"))
    expect(linesWithTracking.length).toBeGreaterThan(0)

    // Verify review branches appear in output
    const outputBefore = resultBefore.stdout
    for (const branch of reviewBranches) {
      expect(outputBefore).toContain(branch)
    }

    // Delete one of the review branches
    const branchToDelete = reviewBranches[0]!
    await git.deleteLocalBranch(branchToDelete, true)

    // Run glu ls again
    const resultAfter = await execa("node", [gluPath, "ls"], {
      cwd: repo.path,
      reject: false,
    })

    expect(resultAfter.exitCode).toBe(0)

    // Verify deleted branch no longer appears in output
    const outputAfter = resultAfter.stdout
    expect(outputAfter).not.toContain(branchToDelete)

    // Verify remaining branches still appear
    for (let i = 1; i < reviewBranches.length; i++) {
      expect(outputAfter).toContain(reviewBranches[i])
    }
  })

  test("prunes deleted remote branches from tracking info", async () => {
    // Setup: Create stack and push a review branch
    repo = await gitFixture.createBasicStack()
    const git = simpleGit(repo.path)

    // Create review branch
    await execa("node", [gluPath, "rr", "1", "--no-push"], {
      cwd: repo.path,
    })

    const branches = await git.branch()
    const reviewBranch = Object.keys(branches.branches).find(
      (b) => b !== "feature-branch" && !b.startsWith("remotes/")
    )!

    // Manually create a fake remote ref to simulate pushed branch
    const fs = await import("fs-extra")
    const path = await import("path")

    // Get the branch's commit hash
    const branchHash = await git.revparse([reviewBranch])

    // Create the remote ref path, handling nested directories in branch name
    const remoteRefPath = path.join(
      repo.path,
      ".git",
      "refs",
      "remotes",
      "origin",
      reviewBranch
    )

    // Ensure the parent directory exists (handles branch names with slashes)
    await fs.ensureDir(path.dirname(remoteRefPath))
    await fs.writeFile(remoteRefPath, branchHash + "\n")

    // Verify remote branch exists
    const branchesWithRemote = await git.branch(["-a"])
    expect(branchesWithRemote.all).toContain(`remotes/origin/${reviewBranch}`)

    // Delete the remote ref (simulating remote branch deletion)
    await fs.remove(remoteRefPath)

    // Run glu ls - should prune the deleted remote branch
    const result = await execa("node", [gluPath, "ls"], {
      cwd: repo.path,
      reject: false,
    })

    expect(result.exitCode).toBe(0)

    // The local branch still exists, but the remote tracking should be cleaned up
    // This test mainly verifies that glu ls doesn't crash when remote branches are deleted
    expect(result.stdout).toBeTruthy()
  })
})
