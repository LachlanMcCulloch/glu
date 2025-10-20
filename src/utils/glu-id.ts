import crypto from "crypto"

/**
 * Generate a unique glu-id for commit tracking
 *
 * Format: glu_{timestamp}_{random}
 *
 * The timestamp uses base36 encoding (0-9, a-z) for several reasons:
 * - Compactness: ~30% shorter than base10 (9 vs 13 chars for current timestamps)
 * - Chronological ordering: Lexicographic string sorting matches temporal order
 * - Readability: Human-readable without special characters
 * - Git compatibility: Lowercase alphanumeric chars avoid git trailer issues
 * - URL/filesystem safe: No escaping needed in branch names or file paths
 *
 * Random component uses 6 hex bytes (12 chars) to prevent collisions when
 * multiple commits are created within the same millisecond.
 *
 * Example: glu_k8j5x6h48_a1b2c3d4e5f6
 *
 * Collision probability: ~1 in 16^12 for same-millisecond commits (negligible)
 * Chronological span: Base36 timestamps work until year ~8000 CE
 */
export function generateGluId(): string {
  const timestamp = Date.now().toString(36)
  const random = crypto.randomBytes(6).toString("hex")
  return `glu_${timestamp}_${random}`
}

/**
 * Check if a commit message contains a glu-id
 */
export function hasGluId(commitMessage: string): boolean {
  return extractGluId(commitMessage) !== null
}

/**
 * Extract glu-id from commit message
 */
export function extractGluId(commitMessage: string): string | null {
  const match = commitMessage.match(/Glu-ID: (glu_\w+)/)
  return match?.[1] || null
}

/**
 * Add glu-id to commit message using git trailer format
 */
export function addGluIdToMessage(
  commitMessage: string,
  gluId?: string
): string {
  if (hasGluId(commitMessage)) {
    return commitMessage
  }

  const id = gluId || generateGluId()

  // Ensure message ends with newline before adding trailer
  const normalizedMessage = commitMessage.trim()
  return `${normalizedMessage}\n\nGlu-ID: ${id}`
}

/**
 * Remove glu-id from commit message
 */
export function removeGluIdFromMessage(commitMessage: string): string {
  return commitMessage.replace(/(\n\n|\n)Glu-ID: glu_\w+/, "")
  // return commitMessage.replace(/\n\nGlu-ID: glu_\w+/, "")
}
