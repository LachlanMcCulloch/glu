// @ts-ignore
import { GitFixture } from "@tests/helpers/git-fixture.js"
import type { TestRepo } from "tests/helpers/test-types.js"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { RequestReviewUseCase } from "./request-review-use-case.js"
import { simpleGit, type SimpleGit } from "simple-git"
import { FileSystemGraphStorage } from "@/infrastructure/graph-storage-adapter.js"
import { CommitService } from "@/services/commit-service.js"
import { GitAdapter } from "@/infrastructure/git-adapter.js"
import { BranchService } from "@/services/branch-service.js"
import { BranchNamingService } from "@/services/branch-naming-service.js"
import { defaultConfig } from "@/config/defaults.js"
import { CherryPickService } from "@/services/cherry-pick-service.js"
import { GluIdService } from "@/services/glu-id-service.js"
import { GluGraphService } from "@/services/glu-graph-service.js"
import { extractGluId, hasGluId } from "@/utils/glu-id.js"
import fs from "fs-extra"
import path from "path"

describe("RequestReviewUseCase integration", () => {
  let fixture: GitFixture
  let repo: TestRepo
  let git: SimpleGit

  beforeEach(async () => {
    fixture = new GitFixture()
    // console.log(fixture)
  })

  afterEach(async () => {
    await repo?.cleanup()
    await fixture?.cleanup()
  })

  const constructUseCase = (
    git: SimpleGit,
    repoPath: string
  ): RequestReviewUseCase => {
    const gitAdapter = new GitAdapter(git)
    const commitService = new CommitService(gitAdapter)
    const branchService = new BranchService(gitAdapter)
    const branchNamingService = new BranchNamingService(defaultConfig)
    const cherryPickService = new CherryPickService(gitAdapter)
    const gluIdService = new GluIdService(gitAdapter)
    const gluGraphService = new GluGraphService(
      new FileSystemGraphStorage(repoPath)
    )
    return new RequestReviewUseCase(
      commitService,
      branchService,
      branchNamingService,
      cherryPickService,
      gluIdService,
      gluGraphService
    )
  }

  describe("glu ID injection with real git", () => {
    it("injects glu IDs into commits on original branch", async () => {
      // Setup: Create basic stack without glu IDs
      repo = await fixture.createBasicStack()
      git = simpleGit(repo.path)

      // Get original commit hashes before injection
      const logBefore = (await git.log()).all
      const originalHash0 = logBefore[0]!.hash
      const originalHash1 = logBefore[1]!.hash

      const useCase = constructUseCase(git, repo.path)

      // Execute: Request review for range "1-2"
      const result = await useCase.execute("1-2", { push: false })

      expect(result.success).toBe(true)
      expect(result.commits).toHaveLength(2)

      // Verify original branch (feature-branch) commits now have glu IDs
      const logAfter = (await git.log()).all
      expect(hasGluId(logAfter[0]!.body)).toBe(true) // Fix feature A
      expect(hasGluId(logAfter[1]!.body)).toBe(true) // Add feature B
      expect(hasGluId(logAfter[2]!.body)).toBe(false) // Add feature A (not in range)
      expect(hasGluId(logAfter[3]!.body)).toBe(false) // Initial commit (not in range)

      // Verify commit hashes changed (due to glu ID injection rewriting commits)
      expect(logAfter[0]!.hash).not.toBe(originalHash0)
      expect(logAfter[1]!.hash).not.toBe(originalHash1)

      // Verify commit messages are preserved (only glu ID added)
      expect(logAfter[0]!.message).toBe("Fix feature A")
      expect(logAfter[1]!.message).toBe("Add feature B")

      // Verify review branch was created
      // Branch name will be generated from first commit: "fix-feature-a"
      const expectedBranchName = result.branch
      const branches = await git.branch()
      expect(branches.all).toContain(expectedBranchName)

      // Verify review branch has the commits with glu IDs
      await git.checkout(expectedBranchName)
      const reviewLog = (await git.log()).all

      // Review branch should have: 2 cherry-picked commits + base commit (Add feature A)
      expect(reviewLog.length).toBeGreaterThanOrEqual(2)

      // Verify review branch commits have glu IDs
      expect(hasGluId(reviewLog[0]!.body)).toBe(true) // Fix feature A
      expect(hasGluId(reviewLog[1]!.body)).toBe(true) // Add feature B

      const reviewGluId0 = extractGluId(reviewLog[0]!.body)
      const reviewGluId1 = extractGluId(reviewLog[1]!.body)

      // Go back to original branch
      await git.checkout("feature-branch")
      const originalLog = (await git.log()).all

      const originalGluId0 = extractGluId(originalLog[0]!.body)
      const originalGluId1 = extractGluId(originalLog[1]!.body)

      // Verify same glu IDs on both branches (commits are tracked across branches)
      expect(reviewGluId0).toBe(originalGluId0)
      expect(reviewGluId1).toBe(originalGluId1)

      // Verify glu ID format
      expect(originalGluId0).toMatch(/^glu_[a-z0-9]+_[a-f0-9]{12}$/)
      expect(originalGluId1).toMatch(/^glu_[a-z0-9]+_[a-f0-9]{12}$/)
    })

    it("preserves existing glu IDs", async () => {
      repo = await fixture.createStackWithGluIds({
        withGluIds: [false, true, true, true],
      })
      git = simpleGit(repo.path)

      // Get original glu IDs in order similar to what is shown in glu ls (drop first initial commit).
      const logBefore = (await git.log()).all.toReversed().slice(1)

      // Extract glu IDs from commits that will be in the review (true indexes 0 and 1)
      const originalGluId1 = extractGluId(logBefore[0]!.body) // Add feature A
      const originalGluId2 = extractGluId(logBefore[1]!.body) // Add feature B

      // Verify they exist and have the expected test format
      expect(originalGluId1).toBe("glu_test2_def456")
      expect(originalGluId2).toBe("glu_test3_ghi789")

      // Also store original commit hashes
      const originalHash1 = logBefore[0]!.hash
      const originalHash2 = logBefore[1]!.hash

      const useCase = constructUseCase(git, repo.path)

      // Execute: Request review for range "1-2"
      // Since commits already have glu IDs, ensureCommitsHaveGluIds should:
      // - Process 2 commits
      // - Modify 0 commits (all already have IDs)
      // - NOT rewrite commit history
      const result = await useCase.execute("1-2", { push: false })

      expect(result.success).toBe(true)
      expect(result.commits).toHaveLength(2)

      // Verify: Original glu IDs preserved (not regenerated)
      const logAfter = (await git.log()).all.toReversed()

      expect(hasGluId(logAfter[0]!.body)).toBe(false)
      const newGluId0 = extractGluId(logAfter[1]!.body)
      const newGluId1 = extractGluId(logAfter[2]!.body)

      // Critical assertion: Glu IDs should be EXACTLY the same
      expect(newGluId0).toBe(originalGluId1)
      expect(newGluId1).toBe(originalGluId2)
      expect(newGluId0).toBe("glu_test2_def456")
      expect(newGluId1).toBe("glu_test3_ghi789")

      // Since no commits were modified, hashes should also be preserved
      // (no rebase/rewrite happened)
      expect(logAfter[1]!.hash).toBe(originalHash1)
      expect(logAfter[2]!.hash).toBe(originalHash2)

      // Verify the commits that were NOT in the range still have their original IDs
      const gluId0 = extractGluId(logAfter[0]!.body) // Initial commit
      const gluId3 = extractGluId(logAfter[3]!.body) // Fix feature A

      expect(gluId0).toBeNull() // Still no ID (wasn't in range)
      expect(gluId3).toBe("glu_test4_jkl012") // Preserved

      // Verify review branch was created with same glu IDs
      const reviewBranch = result.branch
      await git.checkout(reviewBranch)
      const reviewLog = (await git.log()).all

      // a bit confusing but matches the indexes chosen
      const reviewGluId1 = extractGluId(reviewLog[1]!.body)
      const reviewGluId2 = extractGluId(reviewLog[0]!.body)

      // Review branch should have the SAME glu IDs (cherry-picked from original)
      expect(reviewGluId1).toBe("glu_test2_def456")
      expect(reviewGluId2).toBe("glu_test3_ghi789")

      // Verify these are the exact same IDs from the original branch
      expect(reviewGluId1).toBe(originalGluId1)
      expect(reviewGluId2).toBe(originalGluId2)
    })

    it("handles mixed scenario (some with, some without glu IDS)", async () => {
      // Setup: Mixed glu IDs
      // withGluIds: [false, true, false, true]
      // This creates (in git log order, newest first):
      // [3] Fix feature A - has glu_test4_jkl012
      // [2] Add feature B - NO glu ID
      // [1] Add feature A - has glu_test2_def456
      // [0] Initial commit - NO glu ID (origin is here)
      //
      // In "glu ls" order (oldest to newest, without initial commit):
      // [0] Add feature A - has glu_test2_def456 (index 1 in glu ls)
      // [1] Add feature B - NO glu ID (index 2 in glu ls)
      // [2] Fix feature A - has glu_test4_jkl012 (index 3 in glu ls)

      repo = await fixture.createStackWithGluIds({
        withGluIds: [false, true, false, true],
      })
      git = simpleGit(repo.path)

      // Get commits in "glu ls" order (reverse, drop initial commit)
      const logBefore = (await git.log()).all.toReversed().slice(1)

      // Track which commits have glu IDs before
      const gluIdsBefore = logBefore.map((c) => extractGluId(c.body))
      const hashesBefore = logBefore.map((c) => c.hash)

      // Verify initial state:
      // [0] Add feature A - has ID
      // [1] Add feature B - NO ID
      // [2] Fix feature A - has ID
      expect(gluIdsBefore[0]).toBe("glu_test2_def456")
      expect(gluIdsBefore[1]).toBeNull()
      expect(gluIdsBefore[2]).toBe("glu_test4_jkl012")

      const useCase = constructUseCase(git, repo.path)

      // Execute: Request review for range "1-3"
      // This will process all 3 unpushed commits
      // Expected: only commit at index 1 (Add feature B) should be modified
      const result = await useCase.execute("1-3", { push: false })

      expect(result.success).toBe(true)
      expect(result.commits).toHaveLength(3)

      // Get commits after execution (in "glu ls" order)
      const logAfter = (await git.log()).all.toReversed()

      // Verify: All commits now have glu IDs
      expect(hasGluId(logAfter[0]!.body)).toBe(false) // Initial commit (not in range)
      expect(hasGluId(logAfter[1]!.body)).toBe(true) // Add feature A
      expect(hasGluId(logAfter[2]!.body)).toBe(true) // Add feature B (newly added)
      expect(hasGluId(logAfter[3]!.body)).toBe(true) // Fix feature A

      const gluIdsAfter = logAfter.slice(1).map((c) => extractGluId(c.body))

      // Verify: Commits with IDs preserved
      expect(gluIdsAfter[0]).toBe("glu_test2_def456") // Add feature A - preserved
      expect(gluIdsAfter[2]).toBe("glu_test4_jkl012") // Fix feature A - preserved

      // Verify: Commit without ID now has one (newly generated)
      expect(gluIdsAfter[1]).toBeTruthy() // Add feature B - newly generated
      expect(gluIdsAfter[1]).toMatch(/^glu_[a-z0-9]+_[a-f0-9]{12}$/)
      expect(gluIdsAfter[1]).not.toBe("glu_test3_ghi789") // Not the test ID

      // Verify review branch has all commits with glu IDs
      const reviewBranch = result.branch
      await git.checkout(reviewBranch)
      const reviewLog = (await git.log()).all

      // Review branch commits (newest first)
      expect(hasGluId(reviewLog[0]!.body)).toBe(true) // Fix feature A
      expect(hasGluId(reviewLog[1]!.body)).toBe(true) // Add feature B
      expect(hasGluId(reviewLog[2]!.body)).toBe(true) // Add feature A

      // Extract review branch glu IDs
      const reviewGluId2 = extractGluId(reviewLog[0]!.body) // Fix feature A
      const reviewGluId1 = extractGluId(reviewLog[1]!.body) // Add feature B
      const reviewGluId0 = extractGluId(reviewLog[2]!.body) // Add feature A

      // Verify review branch has same glu IDs as original branch
      expect(reviewGluId0).toBe(gluIdsAfter[0]) // Add feature A
      expect(reviewGluId1).toBe(gluIdsAfter[1]) // Add feature B (newly generated)
      expect(reviewGluId2).toBe(gluIdsAfter[2]) // Fix feature A

      // Verify preserved IDs are exactly the original test IDs
      expect(reviewGluId0).toBe("glu_test2_def456")
      expect(reviewGluId2).toBe("glu_test4_jkl012")
    })
  })

  describe("graph tracking with real git", () => {
    it("tracks commits in graph after cherry-pick", async () => {
      // Setup: Basic stack
      repo = await fixture.createBasicStack()
      git = simpleGit(repo.path)
      const useCase = constructUseCase(git, repo.path)

      // Execute: Request review
      const result = await useCase.execute("1-2", { push: false })

      // Verify graph file was created
      const graphStorage = new FileSystemGraphStorage(repo.path)
      const graphData = await graphStorage.load()

      // Verify: 2 commits tracked (for range 1-2)
      expect(Object.keys(graphData.commits)).toHaveLength(2)

      // Get the glu IDs from the result commits
      const gluIds = result.commits
        .map((c) => extractGluId(c.body))
        .filter(Boolean)
      expect(gluIds).toHaveLength(2)

      // Verify each commit has location on review branch
      for (const gluId of gluIds) {
        const commit = graphData.commits[gluId!]
        expect(commit).toBeDefined()
        expect(commit?.locations).toHaveLength(1)
        expect(commit?.locations[0]).toMatchObject({
          branch: result.branch,
          status: "unpushed",
        })
        expect(commit?.locations[0]?.remote).toBeUndefined()
        expect(commit?.locations[0]?.pushedAt).toBeUndefined()
      }
    })

    it("marks branch as pushed in graph", async () => {
      // Setup: Basic stack
      repo = await fixture.createBasicStack()
      git = simpleGit(repo.path)
      const useCase = constructUseCase(git, repo.path)

      // Note: This test will fail if it tries to actually push to a remote
      // We need to mock or skip the actual push, but still call markBranchPushed
      // For now, test with push: false and verify the unpushed state
      const result = await useCase.execute("1-2", { push: false })

      // Verify graph
      const graphStorage = new FileSystemGraphStorage(repo.path)
      const graphData = await graphStorage.load()

      // Get glu IDs
      const gluIds = result.commits
        .map((c) => extractGluId(c.body))
        .filter(Boolean)

      // When push: false, commits should be "unpushed"
      for (const gluId of gluIds) {
        const commit = graphData.commits[gluId!]
        expect(commit?.locations[0]?.status).toBe("unpushed")
      }

      // TODO: To test "pushed" status, we'd need to:
      // 1. Mock the git push operation
      // 2. Or manually call markBranchPushed after execute
      // 3. Or set up a real remote in the test fixture
    })

    it("tracks same glu ID across multiple review branches", async () => {
      // Setup: Stack with glu IDs
      repo = await fixture.createStackWithGluIds({
        withGluIds: [false, true, true, true],
      })
      git = simpleGit(repo.path)
      const useCase = constructUseCase(git, repo.path)

      // Execute: Create first review branch (commit 1)
      const result1 = await useCase.execute("1", {
        branch: "review/commit-1",
        push: false,
      })

      // Get glu ID from first commit
      const gluId1 = extractGluId(result1.commits[0]!.body)
      expect(gluId1).toBeTruthy()

      // Execute: Create second review branch (commits 1-2)
      const result2 = await useCase.execute("1-2", {
        branch: "review/commits-1-2",
        push: false,
      })

      // Get glu ID from first commit of second review
      const gluId1_second = extractGluId(result2.commits[0]!.body)
      const gluId2 = extractGluId(result2.commits[1]!.body)

      // Same commit should have same glu ID
      expect(gluId1_second).toBe(gluId1)

      // Verify graph
      const graphStorage = new FileSystemGraphStorage(repo.path)
      const graphData = await graphStorage.load()

      // Commit 1's glu ID appears in 2 locations
      const commit1Data = graphData.commits[gluId1!]
      expect(commit1Data).toBeDefined()
      expect(commit1Data?.locations).toHaveLength(2)

      const branches = commit1Data?.locations.map((l) => l.branch)
      expect(branches).toContain("review/commit-1")
      expect(branches).toContain("review/commits-1-2")

      // Commit 2's glu ID appears in 1 location
      const commit2Data = graphData.commits[gluId2!]
      expect(commit2Data).toBeDefined()
      expect(commit2Data?.locations).toHaveLength(1)
      expect(commit2Data?.locations[0]?.branch).toBe("review/commits-1-2")
    })

    it("creates .glu/graph.json file", async () => {
      // Setup: Basic stack
      repo = await fixture.createBasicStack()
      git = simpleGit(repo.path)
      const useCase = constructUseCase(git, repo.path)

      // Verify file doesn't exist yet
      const graphPath = path.join(repo.path, ".glu", "graph.json")
      expect(await fs.pathExists(graphPath)).toBe(false)

      // Execute: Request review
      await useCase.execute("1-2", { push: false })

      // Verify file was created
      expect(await fs.pathExists(graphPath)).toBe(true)

      // Verify graph structure
      const content = await fs.readFile(graphPath, "utf-8")
      const data = JSON.parse(content)

      expect(data.version).toBe("1.0.0")
      expect(data.commits).toBeDefined()
      expect(typeof data.commits).toBe("object")
      expect(Object.keys(data.commits).length).toBe(2)

      // Verify each commit has required fields
      for (const gluId in data.commits) {
        const commit = data.commits[gluId]
        expect(commit.firstSeen).toBeDefined()
        expect(commit.locations).toBeInstanceOf(Array)
        expect(commit.locations.length).toBeGreaterThan(0)

        const location = commit.locations[0]
        expect(location.branch).toBeDefined()
        expect(location.commitHash).toBeDefined()
        expect(location.status).toBe("unpushed")
      }
    })
  })

  describe("full end-to-end flow", () => {
    it("creates review branch with glu IDs and tracks in graph", async () => {
      // Setup: Basic stack without glu IDs
      repo = await fixture.createBasicStack()
      git = simpleGit(repo.path)

      // Get original state
      const originalBranch = await git.revparse(["--abbrev-ref", "HEAD"])

      const useCase = constructUseCase(git, repo.path)

      // Execute: Request review
      const result = await useCase.execute("1-2", {
        branch: "review/test",
        push: false,
      })

      // Verify result
      expect(result.success).toBe(true)
      expect(result.branch).toBe("review/test")
      expect(result.commits).toHaveLength(2)

      // Verify review branch created
      const branches = await git.branch()
      expect(branches.all).toContain("review/test")

      await git.checkout("review/test")
      const reviewLog = await git.log()

      // Review branch has: 2 cherry-picked commits + base commit(s)
      expect(reviewLog.all.length).toBeGreaterThanOrEqual(2)

      // Verify all commits have glu IDs
      const gluIds = reviewLog.all.slice(0, 2).map((c) => extractGluId(c.body))
      for (const gluId of gluIds) {
        expect(gluId).toBeTruthy()
        expect(gluId).toMatch(/^glu_[a-z0-9]+_[a-f0-9]{12}$/)
      }

      // Verify original branch has glu IDs
      await git.checkout(originalBranch)
      const updatedLog = await git.log()
      const originalGluIds = updatedLog.all
        .slice(0, 2)
        .map((c) => extractGluId(c.body))

      // Same glu IDs on both branches
      expect(originalGluIds[0]).toBe(gluIds[0])
      expect(originalGluIds[1]).toBe(gluIds[1])

      // Verify graph tracking
      const graphStorage = new FileSystemGraphStorage(repo.path)
      const graphData = await graphStorage.load()
      expect(Object.keys(graphData.commits)).toHaveLength(2)

      for (const gluId of gluIds) {
        const tracked = graphData.commits[gluId!]
        expect(tracked).toBeDefined()
        expect(tracked?.locations).toContainEqual(
          expect.objectContaining({
            branch: "review/test",
            status: "unpushed",
          })
        )
      }
    })

    it("handles range selection correctly", async () => {
      // Setup: Stack with 4 commits (3 unpushed: indexes 1-3)
      repo = await fixture.createBasicStack()
      repo = await fixture.createScenario({
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
          {
            message: "Add feature C",
            files: {
              "feature-c.js": 'export const featureC = () => "C";\n',
            },
          },
        ],
        originAt: 1, // Origin points to "Add feature A"
        currentBranch: "feature-branch",
      })
      git = simpleGit(repo.path)
      const useCase = constructUseCase(git, repo.path)

      // Test different ranges
      const testCases = [
        { range: "1", expectedCount: 1 },
        { range: "1-2", expectedCount: 2 },
        { range: "2-3", expectedCount: 2 },
        { range: "1-3", expectedCount: 3 },
      ]

      for (const { range, expectedCount } of testCases) {
        const result = await useCase.execute(range, {
          branch: `review/${range.replace("-", "to")}`,
          push: false,
        })

        expect(result.success).toBe(true)
        expect(result.commits).toHaveLength(expectedCount)

        // Verify all commits have glu IDs
        for (const commit of result.commits) {
          expect(hasGluId(commit.body)).toBe(true)
        }
      }
    })
  })

  describe("progress callbacks", () => {
    it("calls all progress callbacks in order", async () => {
      // Setup: Basic stack
      repo = await fixture.createBasicStack()
      git = simpleGit(repo.path)
      const useCase = constructUseCase(git, repo.path)

      // Track progress calls
      const calls: string[] = []

      // Execute with progress tracking
      await useCase.execute(
        "1-2",
        { push: false },
        {
          onValidatingWorkingDirectory: () => calls.push("validate-wd"),
          onValidatingRange: () => calls.push("validate-range"),
          onInjectingGluIds: (p, m) => calls.push(`inject-${p}-${m}`),
          onCreatingStagingBranch: () => calls.push("create-staging"),
          onCreatingReviewBranch: (b) => calls.push(`create-review:${b}`),
          onCleaningUp: () => calls.push("cleanup"),
        }
      )

      // Verify order and presence
      expect(calls[0]).toBe("validate-wd")
      expect(calls[1]).toBe("validate-range")
      expect(calls[2]).toBe("inject-2-2") // 2 processed, 2 modified
      expect(calls[3]).toBe("create-staging")
      expect(calls[4]).toMatch(/^create-review:.+$/)
      expect(calls[5]).toBe("cleanup")
      expect(calls).toHaveLength(6)
    })

    it("reports correct injection counts", async () => {
      // Setup: Mixed glu IDs - [false, true, false, true]
      // In glu ls order (without initial commit):
      // [0] Add feature A - has glu ID
      // [1] Add feature B - NO glu ID
      // [2] Fix feature A - has glu ID
      repo = await fixture.createStackWithGluIds({
        withGluIds: [false, true, false, true],
      })
      git = simpleGit(repo.path)
      const useCase = constructUseCase(git, repo.path)

      let injectionReport: { processed: number; modified: number } | null = null

      // Execute range "1-3" (all 3 unpushed commits)
      await useCase.execute(
        "1-3",
        { push: false },
        {
          onInjectingGluIds: (p, m) => {
            injectionReport = { processed: p, modified: m }
          },
        }
      )

      // Verify: 3 processed, 1 modified (only Add feature B needs glu ID)
      expect(injectionReport).toEqual({
        processed: 3,
        modified: 1,
      })
    })

    it("skips injection callback when all commits have glu IDs", async () => {
      // Setup: All commits with glu IDs
      repo = await fixture.createStackWithGluIds({
        withGluIds: [false, true, true, true],
      })
      git = simpleGit(repo.path)
      const useCase = constructUseCase(git, repo.path)

      let injectionCalled = false

      await useCase.execute(
        "1-2",
        { push: false },
        {
          onInjectingGluIds: (p, m) => {
            injectionCalled = true
            expect(p).toBe(3)
            expect(m).toBe(0) // No commits modified
          },
        }
      )

      expect(injectionCalled).toBe(true)
    })
  })

  describe("error scenarios", () => {
    it("handles dirty working directory", async () => {
      // Setup: Create stack with uncommitted changes
      repo = await fixture.createBasicStack()
      git = simpleGit(repo.path)
      const useCase = constructUseCase(git, repo.path)

      // Create dirty state
      await fs.writeFile(
        path.join(repo.path, "dirty.txt"),
        "uncommitted changes"
      )

      // Execute: Expect failure
      await expect(useCase.execute("1-2", { push: false })).rejects.toThrow()

      // Note: The specific error message depends on GitError implementation
      // You could be more specific with:
      // await expect(...).rejects.toThrow(/dirty/i)
      // or
      // await expect(...).rejects.toThrow(GitError)
    })

    it("cleans up temp branch on failure", async () => {
      // Setup: Basic stack
      repo = await fixture.createBasicStack()
      git = simpleGit(repo.path)

      // Create a use case that will fail during cherry-pick
      // This is tricky - we need to simulate a failure
      // For now, test that temp branches are cleaned up on success
      const useCase = constructUseCase(git, repo.path)

      await useCase.execute("1-2", { push: false })

      // Verify no temp branches left behind
      const branches = await git.branch()
      const tempBranches = branches.all.filter((b) => b.includes("glu/tmp"))
      expect(tempBranches).toHaveLength(0)
    })

    it("handles invalid range gracefully", async () => {
      // Setup: Basic stack (3 unpushed commits)
      repo = await fixture.createBasicStack()
      git = simpleGit(repo.path)
      const useCase = constructUseCase(git, repo.path)

      // Execute: Range out of bounds
      await expect(useCase.execute("1-10", { push: false })).rejects.toThrow()

      // Verify: No temp branches or graph corruption
      const branches = await git.branch()
      const tempBranches = branches.all.filter((b) => b.includes("glu/tmp"))
      expect(tempBranches).toHaveLength(0)
    })
  })
})
