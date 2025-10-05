import fs from "fs-extra"
import path from "path"
import { simpleGit } from "simple-git"

interface BranchTrackingData {
  [gluId: string]: string[]
}

/**
 * Get the path to the branch tracking file
 */
async function getTrackingFilePath(): Promise<string> {
  const git = simpleGit()
  const gitDir = await git.revparse(["--git-dir"])
  return path.join(gitDir, "glu-branch-tracking.json")
}

/**
 * Load branch tracking data
 */
export async function loadBranchTracking(): Promise<BranchTrackingData> {
  try {
    const trackingFile = await getTrackingFilePath()
    if (await fs.pathExists(trackingFile)) {
      const data = await fs.readJson(trackingFile)
      return data || {}
    }
  } catch (error) {
    // If file doesn't exist or is corrupted, return empty object
  }
  return {}
}

/**
 * Save branch tracking data
 */
export async function saveBranchTracking(
  data: BranchTrackingData
): Promise<void> {
  try {
    const trackingFile = await getTrackingFilePath()
    await fs.writeJson(trackingFile, data, { spaces: 2 })
  } catch (error) {
    console.warn("Failed to save branch tracking data:", error)
  }
}

/**
 * Add branch to glu-id tracking
 */
export async function addBranchToTracking(
  gluId: string,
  branchName: string
): Promise<void> {
  const tracking = await loadBranchTracking()

  if (!tracking[gluId]) {
    tracking[gluId] = []
  }

  if (!tracking[gluId].includes(branchName)) {
    tracking[gluId].push(branchName)
  }

  await saveBranchTracking(tracking)
}

/**
 * Remove branch from glu-id tracking
 */
export async function removeBranchFromTracking(
  branchName: string
): Promise<void> {
  const tracking = await loadBranchTracking()

  for (const gluId in tracking) {
    tracking[gluId] = (tracking[gluId] || []).filter(
      (branch) => branch !== branchName
    )
    if (tracking[gluId]?.length === 0) {
      delete tracking[gluId]
    }
  }

  await saveBranchTracking(tracking)
}

/**
 * Get branches tracked by glu-id
 */
export async function getBranchesForGluId(gluId: string): Promise<string[]> {
  const tracking = await loadBranchTracking()
  return tracking[gluId] || []
}

/**
 * Clean up tracking data for non-existent branches
 */
export async function cleanupBranchTracking(): Promise<void> {
  const git = simpleGit()
  const tracking = await loadBranchTracking()

  // Get all existing branches
  const branches = await git.branch(["-a"])
  const existingBranches = new Set(
    (branches.all || [])
      .filter((branch) => !branch.startsWith("remotes/origin/"))
      .map((branch) => branch.replace(/^\*?\s*/, ""))
  )

  // Remove tracking for non-existent branches
  let modified = false
  for (const gluId in tracking) {
    const branchList = tracking[gluId] || []
    const originalLength = branchList.length
    tracking[gluId] = branchList.filter((branch) =>
      existingBranches.has(branch)
    )

    if (tracking[gluId]?.length === 0) {
      delete tracking[gluId]
      modified = true
    } else if ((tracking[gluId]?.length || 0) !== originalLength) {
      modified = true
    }
  }

  if (modified) {
    await saveBranchTracking(tracking)
  }
}
