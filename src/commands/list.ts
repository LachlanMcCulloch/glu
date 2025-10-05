import { simpleGit } from "simple-git"
import chalk from "chalk"
import { loadConfig } from "../config/index.js"
import { extractGluId } from "../utils/glu-id.js"
import {
  getBranchesForGluId,
  cleanupBranchTracking,
} from "../utils/branch-tracking.js"

export async function listCommits() {
  try {
    const git = simpleGit()
    const config = loadConfig()

    // Clean up stale branch tracking data
    await cleanupBranchTracking()

    // Get the current branch
    const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"])

    if (currentBranch === "HEAD") {
      console.error(
        "Currently in detached HEAD state. Please checkout a branch."
      )
      process.exit(1)
    }

    // Check if origin exists and has the current branch
    const remotes = await git.getRemotes(true)
    const originRemote = remotes.find((r: any) => r.name === "origin")

    if (!originRemote) {
      console.error(
        "No origin remote found. Please add an origin remote first."
      )
      process.exit(1)
    }

    const originBranch = `origin/${currentBranch}`

    // Check if origin branch exists
    try {
      await git.revparse(["--verify", originBranch])
    } catch {
      console.error(
        `No origin branch found for ${currentBranch}. Push the branch first or there are no commits to compare.`
      )
      process.exit(1)
    }

    // Get commits that are on current branch but not on origin branch
    const logOptions = {
      from: originBranch,
      to: "HEAD",
      format: {
        hash: "%H",
        abbreviated_hash: "%h",
        subject: "%s",
        author_name: "%an",
        author_date: "%ad",
      },
    }

    const log = await git.log({
      from: originBranch,
      to: "HEAD",
      symmetric: false,
      format: {
        hash: "%H",
        abbreviated_hash: "%h",
        subject: "%s",
        body: "%B",
        author_name: "%an",
        author_date: "%ad",
      },
    })

    // Get ahead/behind counts using git rev-list --count for accuracy
    const aheadCount = log.all.length
    const behindCountResult = await git.raw([
      "rev-list",
      "--count",
      `HEAD..${originBranch}`,
    ])
    const behindCount = parseInt(behindCountResult.trim())

    // Format the header with arrow and unicode symbols
    const arrow = chalk.gray("→")
    const upArrow =
      aheadCount > 0 ? chalk.green(`↑${aheadCount}`) : chalk.gray("↑0")
    const downArrow =
      behindCount > 0 ? chalk.red(`↓${behindCount}`) : chalk.gray("↓0")

    console.log(
      `${chalk.cyan(currentBranch)} ${arrow} ${chalk.cyan(originBranch)} [${upArrow} ${downArrow}]`
    )
    console.log() // Empty line for spacing

    if (aheadCount === 0) {
      console.log(`No commits found ahead of ${originBranch}`)
      return
    }

    // Process commits and get branch information
    for (const [index, commit] of log.all.entries()) {
      const shortSha = commit.hash.substring(0, 7)
      const message =
        commit.subject.length > 60
          ? commit.subject.substring(0, 57) + "..."
          : commit.subject

      // Get branches containing this commit (if feature is enabled)
      let branchInfo = ""
      if (config.list?.showBranches !== false) {
        const fullMessage = commit.body || commit.subject
        const gluId = extractGluId(fullMessage)

        if (gluId) {
          const branches = await getBranchesForGluId(gluId)
          const filteredBranches = branches.filter(
            (branch) => branch !== currentBranch
          )

          if (filteredBranches.length > 0) {
            const maxBranches = config.list?.maxBranchesDisplayed || 5
            const displayBranches = filteredBranches.slice(0, maxBranches)
            const branchList = displayBranches.join(", ")
            const truncatedList =
              filteredBranches.length > maxBranches
                ? branchList + ", ..."
                : branchList
            branchInfo = ` ${chalk.gray(`(${truncatedList})`)}`
          }
        }
      }

      // Format with consistent spacing - 2 spaces before index, 2 spaces after index
      const paddedIndex = (log.all.length - index).toString().padStart(2)
      console.log(
        `  ${chalk.cyan(paddedIndex)}  ${chalk.yellow(shortSha)}  ${message}${branchInfo}`
      )
    }
  } catch (error) {
    console.error("Error:", error)
    process.exit(1)
  }
}
