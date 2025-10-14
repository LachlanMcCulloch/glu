import { simpleGit } from "simple-git"
import { beforeEach, describe, expect, it } from "vitest"
import { GluIdService } from "./glu-id-service.js"
import { GitAdapter } from "@/infrastructure/git-adapter.js"
import type { Commit } from "@/core/types.js"
import { extractGluId } from "@/utils/glu-id.js"
import type { TestRepo } from "tests/helpers/test-types.js"
import { GitFixture } from "tests/helpers/git-fixture.js"
import { afterEach } from "node:test"

describe("GluIdService integration", () => {
  let fixture: GitFixture
  let repo: TestRepo

  beforeEach(async () => {
    fixture = new GitFixture()
  })

  afterEach(async () => {
    await repo.cleanup()
    await fixture.cleanup()
  })

  describe("when no commits have glu IDs", () => {
    it("injects glu IDS into real commits", async () => {
      repo = await fixture.createBasicStack()
      const git = simpleGit(repo.path)

      let log = await git.log()
      const transformed: Commit[] = log.all.map((commit) => ({
        hash: commit.hash,
        subject: commit.message,
        body: commit.body,
      }))

      // Drop the oldest commit as the rebase needs something to bind onto
      transformed.pop()

      const gitAdapter = new GitAdapter(git)
      const service = new GluIdService(gitAdapter)

      const result = await service.ensureCommitsHaveGluIds(transformed)

      expect(result.commitsModified).toBe(3)

      log = await git.log()

      // initial commit (last commit) won't have a glu id
      const expectedCommitsAffected = log.all.slice(0, log.all.length - 1)
      const gluIds = expectedCommitsAffected.map((commit) =>
        extractGluId(commit.body)
      )

      for (const gluId of gluIds) {
        expect(gluId).toBeTruthy()
      }
    })
  })

  describe("when all commits already have glu IDs", () => {
    it("does not modify any commits", async () => {
      repo = await fixture.createStackWithGluIds({
        withGluIds: [false, true, true, true], // All except initial commit
      })

      const git = simpleGit(repo.path)
      let log = await git.log()

      const commits: Commit[] = log.all.slice(0, -1).map((c) => ({
        hash: c.hash,
        subject: c.message,
        body: c.body,
      }))

      // Save original hashes
      const originalHashes = commits.map((c) => c.hash)

      const gitAdapter = new GitAdapter(git)
      const service = new GluIdService(gitAdapter)
      const result = await service.ensureCommitsHaveGluIds(commits)

      expect(result.commitsProcessed).toBe(3)
      expect(result.commitsModified).toBe(0)

      // Verify hashes didn't change (no rebase happened)
      log = await git.log()
      const currentHashes = log.all.slice(0, -1).map((c) => c.hash)

      expect(currentHashes).toEqual(originalHashes)
    })

    it("preserves existing glu IDs", async () => {
      const existingGluIds = ["glu_test1_abc", "glu_test2_def", "glu_test3_ghi"]

      repo = await fixture.createStackWithGluIds({
        withGluIds: [false, true, true, true],
      })

      const git = simpleGit(repo.path)
      let log = await git.log()

      const commits: Commit[] = log.all.slice(0, -1).map((c) => ({
        hash: c.hash,
        subject: c.message,
        body: c.body,
      }))

      const gitAdapter = new GitAdapter(git)
      const service = new GluIdService(gitAdapter)
      await service.ensureCommitsHaveGluIds(commits)

      // Verify original glu IDs are preserved
      log = await git.log()
      const gluIds = log.all.slice(0, -1).map((c) => extractGluId(c.body))

      for (const gluId of gluIds) {
        expect(gluId).toBeTruthy()
        // Should be one of the original IDs we set
        expect(gluId).toMatch(/^glu_test\d+_[a-z0-9]+$/)
      }
    })
  })

  describe("when some commits have glu IDs (mixed scenario)", () => {
    it("only injects glu IDs into commits without them", async () => {
      repo = await fixture.createStackWithGluIds({
        withGluIds: [false, true, false, true], // 1st and 3rd need IDs
      })

      const git = simpleGit(repo.path)
      let log = await git.log()

      const commits: Commit[] = log.all.slice(0, -1).map((c) => ({
        hash: c.hash,
        subject: c.message,
        body: c.body,
      }))

      // Track which had IDs before
      const hadGluIdBefore = commits.map((c) => extractGluId(c.body) !== null)

      const gitAdapter = new GitAdapter(git)
      const service = new GluIdService(gitAdapter)
      const result = await service.ensureCommitsHaveGluIds(commits)

      expect(result.commitsProcessed).toBe(3)
      expect(result.commitsModified).toBe(1) // Only commits without IDs

      // Verify all commits now have glu IDs
      log = await git.log()
      const updatedCommits = log.all.slice(0, -1)

      for (let i = 0; i < updatedCommits.length; i++) {
        const gluId = extractGluId(updatedCommits[i]!.body)
        expect(gluId).toBeTruthy()

        if (hadGluIdBefore[i]) {
          // Should preserve original format
          expect(gluId).toMatch(/^glu_test\d+_[a-z0-9]+$/)
        } else {
          // Should be newly generated
          expect(gluId).toMatch(/^glu_[a-z0-9]+_[a-f0-9]{12}$/)
        }
      }
    })

    it("maintains commit order and relationships", async () => {
      repo = await fixture.createStackWithGluIds({
        withGluIds: [false, false, true, false],
      })

      const git = simpleGit(repo.path)
      const logBefore = await git.log()
      const messagesBefore = logBefore.all.slice(0, -1).map((c) => c.message)

      const commits: Commit[] = logBefore.all.slice(0, -1).map((c) => ({
        hash: c.hash,
        subject: c.message,
        body: c.body,
      }))

      const gitAdapter = new GitAdapter(git)
      const service = new GluIdService(gitAdapter)
      await service.ensureCommitsHaveGluIds(commits)

      const logAfter = await git.log()
      const messagesAfter = logAfter.all.slice(0, -1).map(
        (c) => c.message.split("\n")[0] // Get first line (before glu ID)
      )

      // Verify commit messages (minus glu IDs) are in same order
      expect(messagesAfter).toEqual(messagesBefore)
    })
  })

  describe("edge cases", () => {
    it("handles empty commit list", async () => {
      repo = await fixture.createBasicStack()
      const git = simpleGit(repo.path)

      const gitAdapter = new GitAdapter(git)
      const service = new GluIdService(gitAdapter)
      const result = await service.ensureCommitsHaveGluIds([])

      expect(result.commitsProcessed).toBe(0)
      expect(result.commitsModified).toBe(0)
    })

    it("handles single commit without glu ID", async () => {
      repo = await fixture.createStackWithGluIds({
        withGluIds: [false, false, false, false],
      })

      const git = simpleGit(repo.path)
      let log = await git.log()

      // Take only the most recent commit
      const commits: Commit[] = [
        {
          hash: log.all[0]!.hash,
          subject: log.all[0]!.message,
          body: log.all[0]!.body,
        },
      ]

      const gitAdapter = new GitAdapter(git)
      const service = new GluIdService(gitAdapter)
      const result = await service.ensureCommitsHaveGluIds(commits)

      expect(result.commitsModified).toBe(1)

      log = await git.log()
      const gluId = extractGluId(log.all[0]!.body)
      expect(gluId).toBeTruthy()
    })
  })
})
