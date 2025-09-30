import { simpleGit } from "simple-git"
import fs from "fs-extra"
import path from "path"
import os from "os"
import type { TestRepo, CommitData, TestScenario } from "./test-types.js"

export class GitFixture {
  private cleanupCallbacks: Array<() => Promise<void>> = []

  async cleanup(): Promise<void> {
    await Promise.all(this.cleanupCallbacks.map((cb) => cb()))
    this.cleanupCallbacks = []
  }

  private async createTempDir(): Promise<{
    path: string
    cleanup: () => Promise<void>
  }> {
    const tempPath = await fs.mkdtemp(path.join(os.tmpdir(), "glu-test-"))

    const cleanup = async () => {
      try {
        await fs.remove(tempPath)
      } catch (error) {
        console.warn(`Failed to cleanup ${tempPath}:`, error)
      }
    }

    this.cleanupCallbacks.push(cleanup)
    return { path: tempPath, cleanup }
  }

  private async initRepo(repoPath: string): Promise<void> {
    const git = simpleGit(repoPath)

    await git.init()
    await git.addConfig("user.name", "Test User")
    await git.addConfig("user.email", "test@example.com")
    await git.addConfig("init.defaultBranch", "main")
  }

  private async createCommit(
    repoPath: string,
    commit: CommitData
  ): Promise<string> {
    const git = simpleGit(repoPath)

    // Create/modify files
    if (commit.files) {
      for (const [filePath, content] of Object.entries(commit.files)) {
        const fullPath = path.join(repoPath, filePath)
        await fs.ensureDir(path.dirname(fullPath))
        await fs.writeFile(fullPath, content)
      }
    }

    // Stage and commit
    await git.add(".")
    const result = await git.commit(commit.message, undefined, {
      "--author": commit.author
        ? `${commit.author.name} <${commit.author.email}>`
        : "Test User <test@example.com>",
    })

    return result.commit
  }

  private async addOriginRemote(
    repoPath: string,
    originUrl: string = "https://github.com/test/test-repo.git"
  ): Promise<void> {
    const git = simpleGit(repoPath)
    await git.addRemote("origin", originUrl)
  }

  private async setOriginRef(
    repoPath: string,
    branch: string,
    commitHash: string
  ): Promise<void> {
    const refPath = path.join(repoPath, ".git", "refs", "remotes", "origin")
    await fs.ensureDir(refPath)
    await fs.writeFile(path.join(refPath, branch), commitHash + "\n")
  }

  async createScenario(scenario: TestScenario): Promise<TestRepo> {
    const { path: repoPath, cleanup } = await this.createTempDir()

    await this.initRepo(repoPath)
    const git = simpleGit(repoPath)
    const commitHashes: string[] = []

    // Switch to specified branch or stay on main
    const targetBranch = scenario.currentBranch || "main"
    await git.checkoutLocalBranch(targetBranch)

    // Create all commits
    for (const commit of scenario.commits) {
      const hash = await this.createCommit(repoPath, commit)
      commitHashes.push(hash)
    }

    // Add origin remote
    await this.addOriginRemote(repoPath)

    // Set origin ref to specified commit
    if (scenario.originAt >= 0 && scenario.originAt < commitHashes.length) {
      await this.setOriginRef(
        repoPath,
        targetBranch,
        commitHashes[scenario.originAt]!
      )
    }

    return { path: repoPath, cleanup }
  }

  // Pre-built scenarios
  async createBasicStack(): Promise<TestRepo> {
    return this.createScenario({
      name: "Basic Stack",
      commits: [
        {
          message: "Initial commit",
          files: { "README.md": "# Test Project\n" },
        },
        {
          message: "Add feature A",
          files: { "feature-a.js": 'export const featureA = () => "A";\n' },
        },
        {
          message: "Add feature B",
          files: { "feature-b.js": 'export const featureB = () => "B";\n' },
        },
        {
          message: "Fix feature A",
          files: {
            "feature-a.js": 'export const featureA = () => "A_FIXED";\n',
          },
        },
      ],
      originAt: 1, // Origin points to "Add feature A"
      currentBranch: "feature-branch",
    })
  }

  async createNoOriginRepo(): Promise<TestRepo> {
    const { path: repoPath, cleanup } = await this.createTempDir()

    await this.initRepo(repoPath)

    // Create a single commit but no origin remote
    await this.createCommit(repoPath, {
      message: "Initial commit",
      files: { "README.md": "# No Origin Test\n" },
    })

    return { path: repoPath, cleanup }
  }

  async createEmptyRepo(): Promise<TestRepo> {
    const { path: repoPath, cleanup } = await this.createTempDir()
    await this.initRepo(repoPath)
    return { path: repoPath, cleanup }
  }
}
