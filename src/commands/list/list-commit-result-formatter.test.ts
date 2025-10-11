import { describe, test, expect } from "vitest"
import {
  formatHeadline,
  formatCommits,
  ListCommitResultFormatter,
} from "./list-commit-result-formatter.js"
import type { ListResult } from "../../use-cases/list-use-case.js"
import type { IndexedCommit } from "../../core/types.js"
import chalk from "chalk"

// Test data helpers
const createMockCommit = (
  overrides: Partial<IndexedCommit> = {}
): IndexedCommit => ({
  gluIndex: 1,
  hash: "abc1234567890123456",
  subject: "Test commit message",
  body: "Test commit message\n\nDetailed description",
  ...overrides,
})

const createMockListResult = (
  overrides: Partial<ListResult> = {}
): ListResult => ({
  currentBranch: "feature-branch",
  originBranch: "origin/main",
  ahead: 2,
  behind: 0,
  unpushedCommits: [
    createMockCommit({
      gluIndex: 1,
      hash: "abc1234567890",
      subject: "First commit",
    }),
    createMockCommit({
      gluIndex: 2,
      hash: "def9876543210",
      subject: "Second commit",
    }),
  ],
  ...overrides,
})

describe("formatHeadline", () => {
  test("should format branch names with ahead and behind counts", () => {
    const input = createMockListResult({
      currentBranch: "feature",
      originBranch: "origin/main",
      ahead: 3,
      behind: 1,
    })

    const result = formatHeadline(input)

    expect(result).toContain("feature")
    expect(result).toContain("origin/main")

    expect(result).toMatch(/↑3/)
    expect(result).toMatch(/↓1/)
  })

  test("should show zeros when no commits ahead or behind", () => {
    const input = createMockListResult({
      ahead: 0,
      behind: 0,
    })

    const result = formatHeadline(input)

    expect(result).toMatch(/↑0/)
    expect(result).toMatch(/↓0/)
  })

  test("should handle single direction movement", () => {
    const input = createMockListResult({
      ahead: 5,
      behind: 0,
    })

    const result = formatHeadline(input)

    expect(result).toMatch(/↑5/)
    expect(result).toMatch(/↓0/)
  })

  test("should include arrow separator between branches", () => {
    const input = createMockListResult()

    const result = formatHeadline(input)

    expect(result).toMatch(/→/)
  })

  test.each([
    { ahead: 0, behind: 0, aheadColor: chalk.gray, behindColor: chalk.gray },
    { ahead: 5, behind: 0, aheadColor: chalk.green, behindColor: chalk.gray },
    { ahead: 0, behind: 3, aheadColor: chalk.gray, behindColor: chalk.red },
    { ahead: 2, behind: 1, aheadColor: chalk.green, behindColor: chalk.red },
  ])(
    "shows correct color for ahead=$ahead behind=$behind",
    ({ ahead, behind, aheadColor, behindColor }) => {
      const input = createMockListResult({
        ahead,
        behind,
      })

      const result = formatHeadline(input)

      expect(result).toContain(aheadColor(`↑${ahead}`))
      expect(result).toContain(behindColor(`↓${behind}`))
    }
  )
})

describe("formatCommits", () => {
  test("should return no commits message when ahead is 0", () => {
    const input = createMockListResult({
      ahead: 0,
      unpushedCommits: [],
      originBranch: "origin/develop",
    })

    const result = formatCommits(input)

    expect(result).toEqual(["No commits found ahead of origin/develop"])
  })

  test("should format commits with gluIndex, short SHA, and subject", () => {
    const input = createMockListResult({
      ahead: 2,
      unpushedCommits: [
        createMockCommit({
          gluIndex: 1,
          hash: "abc1234567890abcdef",
          subject: "Add new feature",
        }),
        createMockCommit({
          gluIndex: 2,
          hash: "def9876543210fedcba",
          subject: "Fix bug in authentication",
        }),
      ],
    })

    const result = formatCommits(input)

    // Should have 2 commits formatted
    expect(result).toHaveLength(2)

    // First commit (reversed order - newest first in display)
    expect(result[0]).toMatch(/2/) // gluIndex
    expect(result[0]).toMatch(/def9876/) // short SHA (7 chars)
    expect(result[0]).toContain("Fix bug in authentication")

    // Second commit
    expect(result[1]).toMatch(/1/) // gluIndex
    expect(result[1]).toMatch(/abc1234/) // short SHA
    expect(result[1]).toContain("Add new feature")
  })

  test("should truncate long commit messages", () => {
    const longMessage =
      "This is a very long commit message that exceeds sixty characters and should be truncated"
    const input = createMockListResult({
      ahead: 1,
      unpushedCommits: [
        createMockCommit({
          gluIndex: 1,
          subject: longMessage,
        }),
      ],
    })

    const result = formatCommits(input)

    expect(result[0]).toContain("...")
    expect(result[0]).not.toContain(longMessage)
    // Should be truncated to 57 chars + "..."
    const commitLine = result[0]!
    const truncatedPart = commitLine.substring(commitLine.lastIndexOf("  ") + 2)
    expect(truncatedPart.length).toBeLessThanOrEqual(60)
  })

  test("should not truncate short commit messages", () => {
    const shortMessage = "Short message"
    const input = createMockListResult({
      ahead: 1,
      unpushedCommits: [
        createMockCommit({
          gluIndex: 1,
          subject: shortMessage,
        }),
      ],
    })

    const result = formatCommits(input)

    expect(result[0]).toContain(shortMessage)
    expect(result[0]).not.toContain("...")
  })

  test("should reverse commit order (newest first)", () => {
    const input = createMockListResult({
      ahead: 3,
      unpushedCommits: [
        createMockCommit({ gluIndex: 1, subject: "Oldest commit" }),
        createMockCommit({ gluIndex: 2, subject: "Middle commit" }),
        createMockCommit({ gluIndex: 3, subject: "Newest commit" }),
      ],
    })

    const result = formatCommits(input)

    // Should be in reverse order (newest first)
    expect(result[0]).toContain("Newest commit")
    expect(result[1]).toContain("Middle commit")
    expect(result[2]).toContain("Oldest commit")
  })

  test("should format with proper spacing and structure", () => {
    const input = createMockListResult({
      ahead: 1,
      unpushedCommits: [
        createMockCommit({
          gluIndex: 5,
          hash: "abc1234",
          subject: "Test commit",
        }),
      ],
    })

    const result = formatCommits(input)

    // Should have proper structure: "  {gluIndex}  {shortSha}  {message}"
    expect(result[0]).toMatch(/^\s+\d+\s+\w{7}\s+/)
  })
})

describe("ListCommitResultFormatter", () => {
  test("should combine headline and commits with empty line separator", () => {
    const input = createMockListResult({
      currentBranch: "my-feature",
      originBranch: "origin/main",
      ahead: 2,
      behind: 1,
    })

    const result = ListCommitResultFormatter.format(input)

    // Should have headline + empty line + commits
    expect(result.length).toBeGreaterThan(3)

    // First line should be headline
    expect(result[0]).toContain("my-feature")
    expect(result[0]).toContain("origin/main")

    // Second line should be empty
    expect(result[1]).toBe("")

    // Remaining lines should be commits
    expect(result[2]).toMatch(/\d+/) // Contains gluIndex
  })

  test("should handle edge case with no commits ahead", () => {
    const input = createMockListResult({
      ahead: 0,
      behind: 2,
      unpushedCommits: [],
    })

    const result = ListCommitResultFormatter.format(input)

    // Should have headline + empty line + no commits message
    expect(result).toHaveLength(3)
    expect(result[0]).toMatch(/↑0/)
    expect(result[0]).toMatch(/↓2/)
    expect(result[1]).toBe("")
    expect(result[2]).toContain("No commits found ahead")
  })

  test("should maintain consistent formatting structure", () => {
    const input = createMockListResult()

    const result = ListCommitResultFormatter.format(input)

    // Always starts with headline
    expect(typeof result[0]).toBe("string")
    expect(result[0]!.length).toBeGreaterThan(0)

    // Always has empty line separator
    expect(result[1]).toBe("")

    // Has commit content starting from index 2
    expect(result.length).toBeGreaterThanOrEqual(3)
  })

  test("should handle multiple commits correctly", () => {
    const input = createMockListResult({
      ahead: 3,
      unpushedCommits: [
        createMockCommit({ gluIndex: 1, subject: "First" }),
        createMockCommit({ gluIndex: 2, subject: "Second" }),
        createMockCommit({ gluIndex: 3, subject: "Third" }),
      ],
    })

    const result = ListCommitResultFormatter.format(input)

    // Should have headline + empty line + 3 commits
    expect(result).toHaveLength(5)
    expect(result[1]).toBe("") // Empty line
    expect(result[2]).toContain("Third") // Newest first
    expect(result[3]).toContain("Second")
    expect(result[4]).toContain("First") // Oldest last
  })
})
