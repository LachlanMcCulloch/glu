import { describe, expect, it, test, vi } from "vitest"
import {
  addGluIdToMessage,
  extractGluId,
  generateGluId,
  hasGluId,
  removeGluIdFromMessage,
} from "./glu-id.js"

describe("glu-id", () => {
  describe("generateGluId", () => {
    test("generates ID with correct format", () => {
      const id = generateGluId()
      expect(id).toMatch(/^glu_[a-z0-9]+_[a-f0-9]{12}$/)

      const parts = id.split("_")
      expect(parts).toHaveLength(3)
      expect(parts[0]).toBe("glu")
      expect(parts[1]).toMatch(/^[a-z0-9]+$/) // base36 timestamp
      expect(parts[2]).toMatch(/^[a-f0-9]{12}$/) // 6 hex bytes
    })

    test("generates unique IDs", () => {
      const ids = new Set()
      const count = 1000

      for (let i = 0; i < count; i++) {
        const id = generateGluId()
        expect(ids.has(id)).toBe(false) // No duplicates
        ids.add(id)
      }

      expect(ids.size).toBe(count)
    })

    test("generates different IDs in rapid succession", () => {
      const id1 = generateGluId()
      const id2 = generateGluId()
      const id3 = generateGluId()

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(id1).not.toBe(id3)
    })

    test("maintains chronological ordering", async () => {
      const id1 = generateGluId()

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 2))

      const id2 = generateGluId()

      // Extract timestamps for comparison
      const timestamp1 = id1.split("_")[1]
      const timestamp2 = id2.split("_")[1]

      if (!timestamp1 || !timestamp2) {
        expect.fail(`unexpected format of ids: id1 (${id1}), id2 (${id2})`)
      }

      // Later timestamp should sort after earlier (lexicographic)
      expect(timestamp1 < timestamp2).toBe(true)
    })

    test("timestamp component is valid base36", () => {
      const id = generateGluId()
      const timestampStr = id.split("_")[1]

      if (!timestampStr) {
        expect.fail(`unexpected format of id (${timestampStr})`)
      }

      // Should be parseable as base36
      const parsedTimestamp = parseInt(timestampStr, 36)
      expect(Number.isInteger(parsedTimestamp)).toBe(true)
      expect(parsedTimestamp).toBeGreaterThan(0)

      // Should be reasonably close to current time
      const now = Date.now()
      const timeDiff = Math.abs(now - parsedTimestamp)
      expect(timeDiff).toBeLessThan(1000) // Within 1 second
    })

    test("random component has correct entropy", () => {
      const ids = Array.from({ length: 100 }, () => generateGluId())
      const randomParts = ids.map((id) => id.split("_")[2])

      // All should be different (high probability with 6 random bytes)
      const uniqueRandomParts = new Set(randomParts)
      expect(uniqueRandomParts.size).toBe(randomParts.length)
    })

    test("generated IDs are always valid git trailer values", () => {
      for (let i = 0; i < 100; i++) {
        const id = generateGluId()

        // Git trailer values should not contain spaces or special chars
        expect(id).not.toMatch(/\s/)
        expect(id).not.toMatch(/[^a-zA-Z0-9_]/)

        // Should be reasonable length for commit messages
        expect(id.length).toBeLessThan(50)
        expect(id.length).toBeGreaterThan(10)
      }
    })

    test("uses current time for timestamp", () => {
      const mockDate = new Date("2023-10-01T12:00:00Z")
      const spy = vi.spyOn(Date, "now").mockReturnValue(mockDate.getTime())

      const id = generateGluId()
      const expectedTimestamp = mockDate.getTime().toString(36)

      expect(id).toMatch(new RegExp(`^glu_${expectedTimestamp}_[a-f0-9]{12}$`))

      spy.mockRestore()
    })
  })

  describe("hasGluId", () => {
    test("detects glu-id in commit message", () => {
      const messageWithGluId = [
        "feat: add new feature",
        "",
        "Some description here.",
        "",
        "Glu-ID: glu_k8j5x6h48_a1b2c3d4e5f6",
      ].join("\n")
      expect(hasGluId(messageWithGluId)).toBe(true)
    })
    test("returns false when no glu-id present", () => {
      const messageWithoutGluId = [
        "feat: add new feature",
        "",
        "Some description here.",
        "",
        "No glu-id in this message.",
      ].join("\n")
      expect(hasGluId(messageWithoutGluId)).toBe(false)
    })

    test("handles empty commit message", () => {
      expect(hasGluId("")).toBe(false)
    })

    test("handles single line commit message without glu-id", () => {
      expect(hasGluId("feat: simple commit")).toBe(false)
    })

    test("case sensitive glu-id detection", () => {
      const wrongCase = ["feat: add feature", "", "GLU-ID: glu_123_abc"].join(
        "\n"
      )
      expect(hasGluId(wrongCase)).toBe(false)
    })

    test("validates glu-id format requirements", () => {
      const validFormats = [
        ["commit", "", "Glu-ID: glu_abc123_def456789012"].join("\n"),
        ["commit", "", "Glu-ID: glu_xyz789_123456789abc"].join("\n"),
        [
          "long commit message",
          "",
          "with multiple paragraphs",
          "",
          "Glu-ID: glu_k8j5x6h48_a1b2c3d4e5f6",
        ].join("\n"),
      ]

      validFormats.forEach((message) => {
        expect(hasGluId(message)).toBe(true)
      })
    })

    test.each([
      `commit\n\nGlu-ID: invalid_format`, // Wrong prefix
    ])("rejects invalid glu-id formats: (%s)", (message) => {
      expect(hasGluId(message)).toBe(false)
    })

    test("detects glu-id even with multiple trailers", () => {
      const messageWithMultipleTrailers = [
        "feat: add feature",
        "",
        "Some description.",
        "",
        "Signed-off-by: User <user@example.com>",
        "Glu-ID: glu_k8j5x6h48_a1b2c3d4e5f6",
        "Co-authored-by: Another <another@example.com>",
      ].join("\n")

      expect(hasGluId(messageWithMultipleTrailers)).toBe(true)
    })

    test("handles multiple glu-ids (should find first)", () => {
      const messageWithMultipleGluIds = [
        "commit",
        "",
        "Glu-ID: glu_first_123456789012",
        "Glu-ID: glu_second_abcdefghijkl",
      ].join("\n")

      expect(hasGluId(messageWithMultipleGluIds)).toBe(true)
    })

    test("works with conventional commit format", () => {
      const conventionalCommit = [
        "feat(auth): implement JWT token validation",
        "",
        "- Add token expiration checking",
        "- Implement refresh token rotation",
        "- Add comprehensive error handling",
        "",
        "Closes #123",
        "",
        "Glu-ID: glu_k8j5x6h48_a1b2c3d4e5f6",
      ].join("\n")

      expect(hasGluId(conventionalCommit)).toBe(true)
    })

    test("works with merge commit messages", () => {
      const mergeCommit = [
        "Merge pull request #45 from feature/auth",
        "",
        "Add JWT authentication",
        "",
        "Glu-ID: glu_abc123_def456789012",
      ].join("\n")

      expect(hasGluId(mergeCommit)).toBe(true)
    })

    test.each([
      "simple commit",
      "commit\n\nGlu-ID: glu_abc_123456789012",
      "commit\n\nGlu-ID: invalid",
      "commit\n\nno glu id here",
    ])("consistent with extractGluId behavior - %s", (message) => {
      const hasId = hasGluId(message)
      const extractedId = extractGluId(message)

      if (hasId) {
        expect(extractedId).toBeTruthy()
      } else {
        expect(extractedId).toBeNull()
      }
    })
  })

  describe("extractGluId", () => {
    test("extracts glu-id from commit message", () => {
      const messageWithGluId = [
        "feat: add new feature",
        "",
        "Some description here.",
        "",
        "Glu-ID: glu_k8j5x6h48_a1b2c3d4e5f6",
      ].join("\n")

      expect(extractGluId(messageWithGluId)).toBe("glu_k8j5x6h48_a1b2c3d4e5f6")
    })

    test("returns null when no glu-id present", () => {
      const messageWithoutGluId = [
        "feat: add new feature",
        "",
        "Some description here.",
        "No glu-id in this message.",
      ].join("\n")

      expect(extractGluId(messageWithoutGluId)).toBeNull()
    })

    test("handles empty commit message", () => {
      expect(extractGluId("")).toBeNull()
    })

    test("handles single line commit message", () => {
      expect(extractGluId("feat: simple commit")).toBeNull()
    })

    test("extracts from single line with glu-id", () => {
      const singleLine = "commit Glu-ID: glu_abc123_def456789012"
      expect(extractGluId(singleLine)).toBe("glu_abc123_def456789012")
    })

    test("case sensitive extraction", () => {
      const wrongCase = ["feat: add feature", "", "GLU-ID: glu_123_abc"].join(
        "\n"
      )
      expect(extractGluId(wrongCase)).toBeNull()
    })

    test.each([
      {
        message: `commit\n\nGlu-ID: glu_abc123_def456789012`,
        expected: "glu_abc123_def456789012",
      },
      {
        message: `commit\n\nGlu-ID: glu_xyz789_123456789abc`,
        expected: "glu_xyz789_123456789abc",
      },
      {
        message: `long commit

with multiple paragraphs

Glu-ID: glu_k8j5x6h48_a1b2c3d4e5f6`,
        expected: "glu_k8j5x6h48_a1b2c3d4e5f6",
      },
    ])("extracts valid glu-id formats: %expected", ({ message, expected }) => {
      expect(extractGluId(message)).toBe(expected)
    })

    test.each([
      {
        message: `commit\n\nGlu-ID: glu_ABC_123456789012`,
        expected: "glu_ABC_123456789012",
      },
      {
        message: `commit\n\nGlu-ID: glu_abc_short`,
        expected: "glu_abc_short",
      },
      { message: `commit\n\nGlu-ID: glu_123_`, expected: "glu_123_" },
      {
        message: `commit\n\nGlu-ID: glu_under_score_format`,
        expected: "glu_under_score_format",
      },
    ])(
      "accepts current permissive format (due to \\w+ regex): %expected",
      ({ message, expected }) => {
        expect(extractGluId(message)).toBe(expected)
      }
    )

    test("extracts first glu-id when multiple present", () => {
      const messageWithMultiple = [
        "commit",
        "",
        "Glu-ID: glu_first_123456789012",
        "Glu-ID: glu_second_abcdefghijkl",
      ].join("\n")

      expect(extractGluId(messageWithMultiple)).toBe("glu_first_123456789012")
    })

    test("extracts glu-id among other trailers", () => {
      const messageWithTrailers = [
        "feat: add feature",
        "",
        "Some description.",
        "",
        "Signed-off-by: User <user@example.com>",
        "Glu-ID: glu_k8j5x6h48_a1b2c3d4e5f6",
        "Co-authored-by: Another <another@example.com>",
      ].join("\n")

      expect(extractGluId(messageWithTrailers)).toBe(
        "glu_k8j5x6h48_a1b2c3d4e5f6"
      )
    })

    test("extracts from conventional commit format", () => {
      const conventionalCommit = [
        "feat(auth): implement JWT token validation",
        "",
        "- Add token expiration checking",
        "- Implement refresh token rotation",
        "- Add comprehensive error handling",
        "",
        "Closes #123",
        "",
        "Glu-ID: glu_k8j5x6h48_a1b2c3d4e5f6",
      ].join("\n")

      expect(extractGluId(conventionalCommit)).toBe(
        "glu_k8j5x6h48_a1b2c3d4e5f6"
      )
    })

    test("extracts from merge commit messages", () => {
      const mergeCommit = [
        "Merge pull request #45 from feature/auth",
        "",
        "Add JWT authentication",
        "",
        "Glu-ID: glu_abc123_def456789012",
      ].join("\n")

      expect(extractGluId(mergeCommit)).toBe("glu_abc123_def456789012")
    })

    // MARK: Boundary Testing

    test("handles glu-id at start of message", () => {
      const messageStartingWithGluId = "Glu-ID: glu_start_123456789012"
      expect(extractGluId(messageStartingWithGluId)).toBe(
        "glu_start_123456789012"
      )
    })

    test("handles glu-id at end of message", () => {
      const messageEndingWithGluId = [
        "commit message",
        "",
        "Glu-ID: glu_end_123456789012",
      ].join("\n")
      expect(extractGluId(messageEndingWithGluId)).toBe("glu_end_123456789012")
    })

    test.each([
      "commit with glu_something but no trailer",
      "commit\n\nSomething: glu_abc123_def456789012", // Wrong trailer name
      "commit\n\nGlu-ID:glu_missing_space_123456", // Missing space
    ])("ignores partial glu-id matches - %s", (message) => {
      expect(extractGluId(message)).toBeNull()
    })

    // MARK: Consistency Testing

    test.each([
      "simple commit",
      "commit\n\nGlu-ID: glu_abc_123456789012",
      "commit\n\nGlu-ID: invalid",
      "commit\n\nno glu id here",
      "Glu-ID: glu_start_of_message",
    ])("consistent with hasGluId function", (message) => {
      const hasId = hasGluId(message)
      const extractedId = extractGluId(message)

      if (hasId) {
        expect(extractedId).toBeTruthy()
        expect(typeof extractedId).toBe("string")
      } else {
        expect(extractedId).toBeNull()
      }
    })
  })

  // MARK: - addGluIdToMessage

  describe("addGluIdToMessage", () => {
    // MARK: Basic Functionality

    test("adds glu-id to message without existing glu-id", () => {
      const message = "feat: add new feature"
      const result = addGluIdToMessage(message)

      expect(result).toMatch(
        /^feat: add new feature\n\nGlu-ID: glu_[a-z0-9]+_[a-f0-9]{12}$/
      )
      expect(hasGluId(result)).toBe(true)
    })

    test("returns unchanged message when glu-id already exists", () => {
      const messageWithGluId = [
        "feat: add feature",
        "",
        "Glu-ID: glu_existing_123456789012",
      ].join("\n")

      const result = addGluIdToMessage(messageWithGluId)
      expect(result).toBe(messageWithGluId)
    })

    // MARK: Custom Glu-ID Parameter

    test("uses provided glu-id when specified", () => {
      const message = "feat: add feature"
      const customGluId = "glu_custom_abcdefghijkl"

      const result = addGluIdToMessage(message, customGluId)
      expect(result).toBe(
        ["feat: add feature", "", `Glu-ID: ${customGluId}`].join("\n")
      )
    })

    test("ignores custom glu-id when message already has one", () => {
      const messageWithGluId = [
        "feat: existing",
        "",
        "Glu-ID: glu_existing_123456789012",
      ].join("\n")
      const customGluId = "glu_custom_abcdefghijkl"

      const result = addGluIdToMessage(messageWithGluId, customGluId)
      expect(result).toBe(messageWithGluId)
      expect(result).not.toContain(customGluId)
    })

    // MARK: Message Normalization

    test.each([
      "simple message",
      "simple message\n",
      "simple message\n\n",
      "simple message   ",
      "   simple message   \n\n",
    ])("normalizes message whitespace: %s", (message) => {
      const result = addGluIdToMessage(message)
      expect(result).toMatch(/^simple message\n\nGlu-ID: glu_/)
    })

    test("handles multi-line messages correctly", () => {
      const multiLineMessage = [
        "feat: add feature",
        "",
        "This is a longer description",
        "with multiple lines.",
        "",
        "- Added functionality A",
        "- Added functionality B",
      ].join("\n")

      const result = addGluIdToMessage(multiLineMessage)

      expect(result).toMatch(
        /^feat: add feature\n\nThis is a longer description[\s\S]*\n\nGlu-ID: glu_/
      )
      expect(result.split("\n\n")).toHaveLength(4) // Original + empty + description + glu-id
    })

    // MARK: Edge Cases

    test("handles empty message", () => {
      const result = addGluIdToMessage("")
      expect(result).toMatch(/^\n\nGlu-ID: glu_[a-z0-9]+_[a-f0-9]{12}$/)
    })

    test("handles whitespace-only message", () => {
      const result = addGluIdToMessage("   \n\n   ")
      expect(result).toMatch(/^\n\nGlu-ID: glu_[a-z0-9]+_[a-f0-9]{12}$/)
    })

    test("preserves existing trailers", () => {
      const messageWithTrailers = [
        "feat: add feature",
        "",
        "Some description.",
        "",
        "Signed-off-by: User <user@example.com>",
        "Co-authored-by: Another <another@example.com>",
      ].join("\n")

      const result = addGluIdToMessage(messageWithTrailers)

      expect(result).toContain("Signed-off-by: User <user@example.com>")
      expect(result).toContain("Co-authored-by: Another <another@example.com>")
      expect(result).toMatch(/Glu-ID: glu_[a-z0-9]+_[a-f0-9]{12}$/)
    })

    // MARK: Generated vs Custom Glu-ID

    test("generates different glu-ids for same message on multiple calls", () => {
      const message = "feat: add feature"

      const result1 = addGluIdToMessage(message)
      const result2 = addGluIdToMessage(message)

      expect(result1).not.toBe(result2)

      const gluId1 = extractGluId(result1)
      const gluId2 = extractGluId(result2)

      expect(gluId1).not.toBe(gluId2)
      expect(gluId1).toBeTruthy()
      expect(gluId2).toBeTruthy()
    })

    test("custom glu-id produces consistent results", () => {
      const message = "feat: add feature"
      const customGluId = "glu_test_123456789012"

      const result1 = addGluIdToMessage(message, customGluId)
      const result2 = addGluIdToMessage(message, customGluId)

      expect(result1).toBe(result2)
      expect(extractGluId(result1)).toBe(customGluId)
    })

    // MARK: Integration with hasGluId

    test.each([
      "simple commit",
      "feat: add feature\n\nWith description",
      "",
      "   whitespace   \n\n",
      `complex commit

With multiple paragraphs

And existing trailers
Signed-off-by: User <user@example.com>`,
    ])("result always passes hasGluId check: %s", (message) => {
      const result = addGluIdToMessage(message)
      expect(hasGluId(result)).toBe(true)
    })

    test("extractGluId works on result", () => {
      const message = "feat: add feature"
      const customGluId = "glu_test_abcdefghijkl"

      const result = addGluIdToMessage(message, customGluId)
      expect(extractGluId(result)).toBe(customGluId)
    })

    // MARK: Real-World Scenarios

    test.each([
      ["feat: simple commit", /^feat: simple commit\n\nGlu-ID: glu_/],
      [
        "feat(scope): commit with scope",
        /^feat\(scope\): commit with scope\n\nGlu-ID: glu_/,
      ],
      [
        "fix: bug fix\n\nCloses #123",
        /^fix: bug fix\n\nCloses #123\n\nGlu-ID: glu_/,
      ],
      ["Merge pull request #45", /^Merge pull request #45\n\nGlu-ID: glu_/],
    ])("handles common git message format: %s", (message, expectedPattern) => {
      const result = addGluIdToMessage(message)
      expect(result).toMatch(expectedPattern)
    })

    test("preserves conventional commit format", () => {
      const conventionalCommit = [
        "feat(auth): implement JWT validation",
        "",
        "- Add token expiration checking",
        "- Implement refresh token rotation",
        "",
        "BREAKING CHANGE: Auth tokens now expire after 1 hour",
        "",
        "Closes #123",
      ].join("\n")

      const result = addGluIdToMessage(conventionalCommit)

      expect(result).toContain("feat(auth): implement JWT validation")
      expect(result).toContain("BREAKING CHANGE:")
      expect(result).toContain("Closes #123")
      expect(result).toMatch(/\n\nGlu-ID: glu_[a-z0-9]+_[a-f0-9]{12}$/)
    })
  })

  // MARK: - removeGluIdFromMessage

  describe("removeGluIdFromMessage", () => {
    // MARK: Basic Functionality

    test("removes glu-id from commit message", () => {
      const messageWithGluId = [
        "feat: add new feature",
        "",
        "Some description here.",
        "",
        "Glu-ID: glu_k8j5x6h48_a1b2c3d4e5f6",
      ].join("\n")

      const expected = [
        "feat: add new feature",
        "",
        "Some description here.",
      ].join("\n")

      expect(removeGluIdFromMessage(messageWithGluId)).toBe(expected)
    })

    test("returns unchanged message when no glu-id present", () => {
      const messageWithoutGluId = [
        "feat: add new feature",
        "",
        "Some description here.",
        "No glu-id in this message.",
      ].join("\n")

      expect(removeGluIdFromMessage(messageWithoutGluId)).toBe(
        messageWithoutGluId
      )
    })

    // MARK: Edge Cases

    test.each(["", "simple commit", "feat: simple commit\n\nWith description"])(
      "handles messages without glu-id: %s",
      (message) => {
        expect(removeGluIdFromMessage(message)).toBe(message)
      }
    )

    test("handles empty message", () => {
      expect(removeGluIdFromMessage("")).toBe("")
    })

    test("handles single line message", () => {
      const singleLine = "feat: simple commit"
      expect(removeGluIdFromMessage(singleLine)).toBe(singleLine)
    })

    // MARK: Multiple Glu-ID Scenarios

    test("removes only first glu-id when multiple present", () => {
      const messageWithMultiple = [
        "commit",
        "",
        "Glu-ID: glu_first_123456789012",
        "Glu-ID: glu_second_abcdefghijkl",
      ].join("\n")

      const expected = ["commit", "Glu-ID: glu_second_abcdefghijkl"].join("\n")

      expect(removeGluIdFromMessage(messageWithMultiple)).toBe(expected)
    })

    test("preserves other trailers while removing glu-id", () => {
      const messageWithTrailers = [
        "feat: add feature",
        "",
        "Some description.",
        "",
        "Signed-off-by: User <user@example.com>",
        "Glu-ID: glu_k8j5x6h48_a1b2c3d4e5f6",
        "Co-authored-by: Another <another@example.com>",
      ].join("\n")

      const expected = [
        "feat: add feature",
        "",
        "Some description.",
        "",
        "Signed-off-by: User <user@example.com>",
        "Co-authored-by: Another <another@example.com>",
      ].join("\n")

      expect(removeGluIdFromMessage(messageWithTrailers)).toBe(expected)
    })

    // MARK: Format Validation

    test.each([
      {
        message: ["commit", "", "Glu-ID: glu_abc123_def456789012"].join("\n"),
        expected: "commit",
      },
      {
        message: ["commit", "", "Glu-ID: glu_xyz789_123456789abc"].join("\n"),
        expected: "commit",
      },
      {
        message: [
          "feat: complex commit",
          "",
          "With description",
          "",
          "Glu-ID: glu_k8j5x6h48_a1b2c3d4e5f6",
        ].join("\n"),
        expected: ["feat: complex commit", "", "With description"].join("\n"),
      },
    ])("removes valid glu-id formats: $message", ({ message, expected }) => {
      expect(removeGluIdFromMessage(message)).toBe(expected)
    })

    test("handles current permissive regex (\\w+ pattern)", () => {
      // These pass due to current \\w+ implementation
      const permissiveFormats = [
        ["commit", "", "Glu-ID: glu_ABC_123456789012"].join("\n"),
        ["commit", "", "Glu-ID: glu_abc_short"].join("\n"),
        ["commit", "", "Glu-ID: glu_under_score_format"].join("\n"),
      ]

      permissiveFormats.forEach((message) => {
        const result = removeGluIdFromMessage(message)
        expect(result).toBe("commit")
        expect(result).not.toContain("Glu-ID:")
      })
    })

    // MARK: Real-World Scenarios

    test("removes glu-id from conventional commit format", () => {
      const conventionalCommit = [
        "feat(auth): implement JWT token validation",
        "",
        "- Add token expiration checking",
        "- Implement refresh token rotation",
        "- Add comprehensive error handling",
        "",
        "Closes #123",
        "",
        "Glu-ID: glu_k8j5x6h48_a1b2c3d4e5f6",
      ].join("\n")

      const expected = [
        "feat(auth): implement JWT token validation",
        "",
        "- Add token expiration checking",
        "- Implement refresh token rotation",
        "- Add comprehensive error handling",
        "",
        "Closes #123",
      ].join("\n")

      expect(removeGluIdFromMessage(conventionalCommit)).toBe(expected)
    })

    test("removes glu-id from merge commit messages", () => {
      const mergeCommit = [
        "Merge pull request #45 from feature/auth",
        "",
        "Add JWT authentication",
        "",
        "Glu-ID: glu_abc123_def456789012",
      ].join("\n")

      const expected = [
        "Merge pull request #45 from feature/auth",
        "",
        "Add JWT authentication",
      ].join("\n")

      expect(removeGluIdFromMessage(mergeCommit)).toBe(expected)
    })

    // MARK: Boundary Testing

    test("handles glu-id at end of message", () => {
      const messageEndingWithGluId = [
        "commit message",
        "",
        "Glu-ID: glu_end_123456789012",
      ].join("\n")

      expect(removeGluIdFromMessage(messageEndingWithGluId)).toBe(
        "commit message"
      )
    })

    test("ignores glu-id without proper newline format", () => {
      const invalidFormats = [
        "commit with Glu-ID: glu_inline_123456789012 text", // Inline, not trailer
        "commitGlu-ID: glu_missing_space_123456", // Missing newlines
      ]

      invalidFormats.forEach((message) => {
        expect(removeGluIdFromMessage(message)).toBe(message) // Should be unchanged
      })
    })

    // MARK: Integration Testing

    test("inverse of addGluIdToMessage", () => {
      const originalMessage = [
        "feat: add feature",
        "",
        "Some description",
        "",
        "Signed-off-by: User <user@example.com>",
      ].join("\n")

      // Add glu-id then remove it
      const withGluId = addGluIdToMessage(originalMessage)
      const backToOriginal = removeGluIdFromMessage(withGluId)

      expect(backToOriginal).toBe(originalMessage)
    })

    test("result passes hasGluId check", () => {
      const messageWithGluId = [
        "feat: add feature",
        "",
        "Glu-ID: glu_test_123456789012",
      ].join("\n")

      const result = removeGluIdFromMessage(messageWithGluId)

      expect(hasGluId(result)).toBe(false)
      expect(extractGluId(result)).toBeNull()
    })

    test("consistent behavior with other glu-id functions", () => {
      const testMessages = [
        "simple commit",
        ["commit", "", "Glu-ID: glu_abc_123456789012"].join("\n"),
        ["commit", "", "Glu-ID: invalid_format"].join("\n"),
        ["commit", "", "no glu id here"].join("\n"),
      ]

      testMessages.forEach((message) => {
        const result = removeGluIdFromMessage(message)

        // After removal, should never have a glu-id
        expect(hasGluId(result)).toBe(false)
        expect(extractGluId(result)).toBeNull()
      })
    })
  })
})
