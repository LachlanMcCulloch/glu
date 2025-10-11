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

  private async setUpstreamTracking(
    repoPath: string,
    localBranch: string,
    remoteBranch: string
  ): Promise<void> {
    const git = simpleGit(repoPath)

    await git.addConfig(`branch.${localBranch}.remote`, "origin")
    await git.addConfig(
      `branch.${localBranch}.merge`,
      `refs/heads/${remoteBranch}`
    )
  }

  async createScenario(scenario: TestScenario): Promise<TestRepo> {
    const { path: repoPath, cleanup } = await this.createTempDir()

    await this.initRepo(repoPath)
    const git = simpleGit(repoPath)
    const targetBranch = scenario.currentBranch || "main"
    await git.checkoutLocalBranch(targetBranch)

    // Determine divergence point
    const divergePoint = scenario.divergeAt ?? scenario.originAt
    const commitHashes: string[] = []

    // Create commits up to divergence point (common history)
    for (let i = 0; i <= divergePoint && i < scenario.commits.length; i++) {
      const hash = await this.createCommit(repoPath, scenario.commits[i]!)
      commitHashes.push(hash)
    }

    // Save the divergence point hash
    const divergenceHash = commitHashes[divergePoint]!

    // Create local commits (ahead of origin)
    const localCommitHashes = [...commitHashes]
    for (let i = divergePoint + 1; i < scenario.commits.length; i++) {
      const hash = await this.createCommit(repoPath, scenario.commits[i]!)
      localCommitHashes.push(hash)
    }

    // Add origin remote
    await this.addOriginRemote(repoPath)

    // Handle origin commits (behind scenario)
    if (scenario.originCommits && scenario.originCommits.length > 0) {
      // Checkout to divergence point
      await git.checkout(divergenceHash)
      await git.checkoutLocalBranch("temp-origin-branch")

      // Create origin-only commits
      const originHashes = [...commitHashes.slice(0, divergePoint + 1)]
      for (const originCommit of scenario.originCommits) {
        const hash = await this.createCommit(repoPath, originCommit)
        originHashes.push(hash)
      }

      // Set origin ref to the latest origin commit
      await this.setOriginRef(
        repoPath,
        targetBranch,
        originHashes[originHashes.length - 1]!
      )

      // Switch back to target branch
      await git.checkout(targetBranch)
      await git.deleteLocalBranch("temp-origin-branch", true)
    } else {
      // Simple case: origin points to a specific commit in the linear history
      if (scenario.originAt >= 0 && scenario.originAt < commitHashes.length) {
        await this.setOriginRef(
          repoPath,
          targetBranch,
          commitHashes[scenario.originAt]!
        )
      }
    }

    await this.setUpstreamTracking(repoPath, targetBranch, targetBranch)

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

  async createAheadBehindScenario(): Promise<TestRepo> {
    return this.createScenario({
      name: "Ahead and Behind",
      commits: [
        { message: "Initial commit", files: { "README.md": "# Test\n" } },
        {
          message: "Common commit 1",
          files: { "shared.js": "console.log('shared');\n" },
        },
        {
          message: "Common commit 2",
          files: { "shared.js": "console.log('shared v2');\n" },
        },
        // Local commits (ahead)
        {
          message: "Local change 1",
          files: { "local.js": "console.log('local1');\n" },
        },
        {
          message: "Local change 2",
          files: { "local.js": "console.log('local2');\n" },
        },
      ],
      divergeAt: 2, // Diverge after "Common commit 2"
      originAt: 2,
      originCommits: [
        // Origin commits (behind)
        {
          message: "Origin change 1",
          files: { "origin.js": "console.log('origin1');\n" },
        },
        {
          message: "Origin change 2",
          files: { "origin.js": "console.log('origin2');\n" },
        },
      ],
      currentBranch: "feature-branch",
    })
  }

  async createBehindOnlyScenario(): Promise<TestRepo> {
    return this.createScenario({
      name: "Behind Only",
      commits: [
        { message: "Initial commit", files: { "README.md": "# Test\n" } },
        {
          message: "Common commit",
          files: { "shared.js": "console.log('shared');\n" },
        },
      ],
      divergeAt: 1, // No local commits ahead
      originAt: 1,
      originCommits: [
        {
          message: "Origin change 1",
          files: { "origin.js": "console.log('origin1');\n" },
        },
        {
          message: "Origin change 2",
          files: { "origin.js": "console.log('origin2');\n" },
        },
      ],
      currentBranch: "main",
    })
  }

  async createAheadOnlyScenario(): Promise<TestRepo> {
    return this.createScenario({
      name: "Ahead Only",
      commits: [
        { message: "Initial commit", files: { "README.md": "# Test\n" } },
        {
          message: "Origin commit",
          files: { "shared.js": "console.log('shared');\n" },
        },
        // These are ahead of origin
        {
          message: "Local change 1",
          files: { "local.js": "console.log('local1');\n" },
        },
        {
          message: "Local change 2",
          files: { "local.js": "console.log('local2');\n" },
        },
      ],
      originAt: 1, // Origin points to "Origin commit"
      currentBranch: "feature-branch",
    })
  }
}
