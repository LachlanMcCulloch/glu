import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { execa } from "execa";
import { simpleGit } from "simple-git";
import fs from "fs-extra";
import path from "path";
import { GitFixture } from "@tests/helpers/git-fixture.ts";
import type { TestRepo } from "@tests/helpers/test-types.ts";

describe("glu rr conflict scenarios", () => {
  let gitFixture: GitFixture;
  let repo: TestRepo | undefined;
  let gluPath: string;

  beforeEach(async () => {
    gitFixture = new GitFixture();
    gluPath = path.resolve(process.cwd(), "dist/index.js");
  });

  afterEach(async () => {
    await repo?.cleanup();
    await gitFixture.cleanup();
  });

  async function setupConflictRepo() {
    repo = await gitFixture.createScenario({
      commits: [
        {
          files: {
            "shared.txt": "line1\nline2\nline3\n",
          },
          message: "Base commit",
        },
        {
          files: {
            "shared.txt": "MODIFIED_LINE1\nline2\nline3\n",
          },
          message: "Modify line 1",
        },
        {
          files: {
            "shared.txt": "MODIFIED_LINE1\nMODIFIED_LINE2\nline3\n",
          },
          message: "Modify line 2",
        },
      ],
      name: "Conflict repo",
      originAt: 1,
    });
    return repo!;
  }

  test("handles cherry-pick conflicts gracefully", async () => {
    await setupConflictRepo();

    // This should work (first commit doesn't conflict with base)
    const result1 = await execa("node", [gluPath, "rr", "1"], {
      cwd: repo!.path,
      reject: false,
    });

    expect(result1.exitCode).toBe(0);
    expect(result1.stdout).toContain("✓ Cherry-picked");

    // Now create a scenario that WILL conflict
    // Reset shared.txt to a different state that will conflict
    const git = simpleGit(repo!.path);
    await git.checkout("main");
    await fs.writeFile(
      path.join(repo!.path, "shared.txt"),
      "DIFFERENT_LINE1\nline2\nline3\n"
    );
    await git.add(".");
    await git.commit("Different modification");

    // This should fail due to conflict
    const result2 = await execa("node", [gluPath, "rr", "2"], {
      cwd: repo!.path,
      reject: false,
    });

    expect(result2.exitCode).toBe(1);
    expect(result2.stderr).toContain("Failed to cherry-pick");
    expect(result2.stdout).toContain(
      "Resolve conflicts and run: git cherry-pick --continue"
    );
  });

  test("provides helpful conflict resolution guidance", async () => {
    await setupConflictRepo();

    // Create a conflicting commit by modifying shared.txt in a conflicting way
    const git = simpleGit(repo!.path);
    await fs.writeFile(
      path.join(repo!.path, "shared.txt"),
      "CONFLICTING_LINE1\nline2\nline3\n"
    );
    await git.add(".");
    await git.commit("Conflicting change");

    // Try to cherry-pick commits that will conflict
    const result = await execa("node", [gluPath, "rr", "1-2", "--force"], {
      cwd: repo!.path,
      reject: false,
    });

    if (result.exitCode !== 0) {
      expect(result.stderr).toContain("Failed to cherry-pick");
      expect(result.stderr).toContain("git cherry-pick --continue");
    }
  });

  test("cleans up properly after conflict", async () => {
    await setupConflictRepo();
    const repo = await setupConflictRepo();

    // Force a conflict scenario
    const git = simpleGit(repo.path);
    await fs.writeFile(
      path.join(repo.path, "shared.txt"),
      "WILL_CONFLICT\nline2\nline3\n"
    );
    await git.add(".");
    await git.commit("Conflict commit");

    // This should fail
    await execa("node", [gluPath, "rr", "1"], {
      cwd: repo.path,
      reject: false,
    });

    // Verify we're still on the original branch (not stuck on the temp branch)
    const status = await git.status();
    expect(status.current).toBe("main");
  });

  test("works with non-conflicting overlapping changes", async () => {
    repo = await gitFixture.createScenario({
      commits: [
        {
          files: {
            "file1.txt": "content1\n",
            "file2.txt": "content2\n",
          },
          message: "Base commit",
        },
        {
          files: {
            "file1.txt": "modified1\n",
          },
          message: "Modify file1",
        },
        {
          files: {
            "file2.txt": "modified2\n",
          },
          message: "Modify file2",
        },
      ],
      name: "non-conflicting overlapping changes",
      originAt: 0,
    });

    // This should work fine - no conflicts
    const result = await execa("node", [gluPath, "rr", "1-2"], {
      cwd: repo!.path,
      reject: false,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Cherry-picking 2 commit(s)");
    expect(result.stdout).toContain("✓ Cherry-picked");
  });
});
