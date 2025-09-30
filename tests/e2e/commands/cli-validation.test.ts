import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { execa } from "execa"
import { simpleGit } from "simple-git"
import fs from "fs-extra"
import path from "path"
import os from "os"
import { GitFixture } from "@tests/helpers/git-fixture.ts"
import type { TestRepo } from "@tests/helpers/test-types.ts"

describe("CLI argument validation", () => {
  let gluPath: string
  let gitFixture: GitFixture
  let testRepo: TestRepo

  beforeEach(async () => {
    gitFixture = new GitFixture()
    testRepo = await gitFixture.createBasicStack()
    gluPath = path.resolve(process.cwd(), "dist/index.js")
  })

  afterEach(async () => {
    await testRepo.cleanup()
    await gitFixture.cleanup()
  })

  describe("glu ls validation", () => {
    test("shows help when no arguments", async () => {
      const result = await execa("node", [gluPath], {
        cwd: testRepo.path,
        reject: false,
      })

      // Should show help or available commands
      expect(result.stderr).toContain("glu")
      expect(result.stdout || result.stderr).toMatch(/Usage|Commands|help/)
    })

    test("shows help with --help flag", async () => {
      const result = await execa("node", [gluPath, "--help"], {
        cwd: testRepo.path,
        reject: false,
      })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Usage")
      expect(result.stdout).toContain("ls")
      expect(result.stdout).toContain("request-review")
    })

    test("shows version with --version flag", async () => {
      const result = await execa("node", [gluPath, "--version"], {
        cwd: testRepo.path,
        reject: false,
      })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/) // Version format
    })
  })

  describe("glu rr validation", () => {
    test("fails without range argument", async () => {
      const result = await execa("node", [gluPath, "rr"], {
        cwd: testRepo.path,
        reject: false,
      })

      expect(result.exitCode).toBe(1)
      expect(result.stderr || result.stdout).toContain("error")
    })

    test.each([
      "abc", // Non-numeric
      "1-abc", // Partial numeric
      "abc-1", // Partial numeric
      "1-2-3", // Too many parts
      "-1", // Missing start
      "1-", // Missing end
      " ", // Empty
      "1--2", // Double dash
      "1_2", // Wrong separator
    ])('validates range format with range: "%s"', async (invalidRange) => {
      const result = await execa("node", [gluPath, "rr", invalidRange], {
        cwd: testRepo.path,
        reject: false,
      })

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("Invalid range format")
    })

    test("validates negative ranges", async () => {
      const result = await execa("node", [gluPath, "rr", "-1"], {
        cwd: testRepo.path,
        reject: false,
      })

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("Invalid range format")
    })

    test("validates zero ranges", async () => {
      const result = await execa("node", [gluPath, "rr", "0"], {
        cwd: testRepo.path,
        reject: false,
      })

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("Invalid range 0. Available commits: 1-2")
    })

    test("shows help for rr command", async () => {
      const result = await execa("node", [gluPath, "rr", "--help"], {
        cwd: testRepo.path,
        reject: false,
      })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Usage")
      expect(result.stdout).toContain("range")
      expect(result.stdout).toContain("--branch")
      expect(result.stdout).toContain("--no-push")
      expect(result.stdout).toContain("--force")
    })
  })

  describe("Unknown commands", () => {
    test("handles unknown command gracefully", async () => {
      const result = await execa("node", [gluPath, "unknown-command"], {
        cwd: testRepo.path,
        reject: false,
      })

      expect(result.exitCode).toBe(1)
      expect(result.stderr || result.stdout).toMatch(/unknown|error|invalid/i)
    })

    test.each([
      ["lst", "ls"],
      ["lss", "ls"],
      ["request-revieww", "request-review"],
      ["rrr", "rr"],
    ])("suggests valid commands for typo: %s", async (typo, expected) => {
      const result = await execa("node", [gluPath, typo], {
        cwd: testRepo.path,
        reject: false,
      })

      expect(result.exitCode).toBe(1)
      // Should show available commands when unknown command is used
      expect(result.stderr || result.stdout).toContain(
        `(Did you mean ${expected}?)`
      )
    })
  })

  describe("Flag combinations", () => {
    test("handles multiple flags correctly", async () => {
      // await setupBasicRepo();

      const result = await execa(
        "node",
        [gluPath, "rr", "1", "--branch", "test-branch", "--force", "--no-push"],
        {
          cwd: testRepo.path,
          reject: false,
        }
      )

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("Creating branch test-branch")
    })

    test("validates custom branch names", async () => {
      // Valid branch names should work
      const validNames = ["feature/test", "feat-123", "user/feature_branch"]

      for (const name of validNames) {
        const result = await execa(
          "node",
          [gluPath, "rr", "1", "-b", name, "--force", "--no-push"],
          {
            cwd: testRepo.path,
            reject: false,
          }
        )

        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain(`Creating branch ${name}`)
      }
    })

    test("handles conflicting flags appropriately", async () => {
      // Create branch first
      await execa("node", [gluPath, "rr", "1", "--no-push"], {
        cwd: testRepo.path,
        reject: false,
      })

      // Try without --force (should fail)
      const result1 = await execa("node", [gluPath, "rr", "1", "--no-push"], {
        cwd: testRepo.path,
        reject: false,
      })

      expect(result1.exitCode).toBe(1)
      expect(result1.stderr).toContain("already exists")

      // Try with --force (should succeed)
      const result2 = await execa(
        "node",
        [gluPath, "rr", "1", "--force", "--no-push"],
        {
          cwd: testRepo.path,
          reject: false,
        }
      )

      expect(result2.exitCode).toBe(0)
      expect(result2.stdout).toContain("deleting")
    })
  })

  describe("Environment validation", () => {
    test("works outside git repository", async () => {
      // Create non-git directory
      const nonGitDir = await fs.mkdtemp(path.join(os.tmpdir(), "non-git-"))

      try {
        const result = await execa("node", [gluPath, "ls"], {
          cwd: nonGitDir,
          reject: false,
        })

        expect(result.exitCode).toBe(1)
        expect(result.stderr).toMatch(/not a git repository|git|repository/i)
      } finally {
        await fs.remove(nonGitDir)
      }
    })

    test("handles permission errors gracefully", async () => {
      // Create a git repo
      const git = simpleGit(testRepo.path)
      await git.init()

      // Make .git directory read-only (simulating permission issue)
      const gitDir = path.join(testRepo.path, ".git")
      try {
        await fs.chmod(gitDir, 0o444)

        const result = await execa("node", [gluPath, "ls"], {
          cwd: testRepo.path,
          reject: false,
        })

        // Should handle permission error gracefully
        expect(result.exitCode).toBe(1)
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(gitDir, 0o755)
      }
    })
  })
})
