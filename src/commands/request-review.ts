import { simpleGit } from "simple-git"
import { loadConfig } from "../config/index.js"
import { execa } from "execa"

interface RequestReviewOptions {
  branch?: string
  force?: boolean
  push?: boolean
}

export async function requestReview(
  range: string,
  options: RequestReviewOptions
) {
  try {
    const git = simpleGit()

    const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"])

    if (currentBranch === "HEAD") {
      console.error(
        "Currently in detached HEAD state. Please checkout a branch."
      )
      process.exit(1)
    }

    const status = await git.status()
    if (!status.isClean()) {
      console.error(
        "Working directory is not clean. Please commit or stash your changes."
      )
      process.exit(1)
    }

    // Regex to check that matches format "n" or "n-m" where m and n are numbers.
    if (!/^\d+(-\d+)?$/.test(range.trim())) {
      console.error(
        'Invalid range format. Use "n" or "n-m" where n and m are numbers.'
      )
      process.exit(1)
    }
    let startIndex: number
    let endIndex: number

    if (range.includes("-")) {
      const parts = range.split("-")
      const start = parseInt(parts[0]?.trim() || "")
      const end = parseInt(parts[1]?.trim() || "")
      if (parts.length > 2 || isNaN(start) || isNaN(end)) {
        console.error(
          'Invalid range format. Use "n" or "n-m" where n and m are numbers.'
        )
        process.exit(1)
      }
      startIndex = start - 1 // Convert to 0-based
      endIndex = end - 1
    } else {
      const single = parseInt(range.trim())
      if (isNaN(single)) {
        console.error(
          'Invalid range format. Use "n" or "n-m" where n and m are numbers.'
        )
        process.exit(1)
      }
      startIndex = endIndex = single - 1 // Convert to 0-based
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
      format: { hash: "%H", subject: "%s" },
    }
    const log = await git.log(logOptions)

    if (log.all.length === 0) {
      console.log(`No commits found ahead of ${originBranch}`)
      return
    }

    const allCommits = log.all

    // Validate range
    if (
      startIndex < 0 ||
      endIndex >= allCommits.length ||
      startIndex > endIndex
    ) {
      console.error(
        `Invalid range ${range}. Available commits: 1-${allCommits.length}`
      )
      process.exit(1)
    }

    // Select commits in range
    const selectedCommits = allCommits.slice(startIndex, endIndex + 1)

    // Load configuration for branch naming
    const config = loadConfig()

    // Determine target branch name from commit messages or user option
    let targetBranch: string
    if (options.branch) {
      targetBranch = options.branch
    } else if (selectedCommits.length === 1) {
      // Single commit: use full commit message
      const firstCommit = selectedCommits[0]
      const branchFromCommit = firstCommit?.subject
        ? formatCommitMessageToBranchName(firstCommit.subject, config)
        : ""
      const baseBranchName = branchFromCommit || `glu/tmp/${range}`
      targetBranch = config.branchPrefix
        ? `${config.branchPrefix}${baseBranchName}`
        : baseBranchName
    } else {
      // Multiple commits: use first commit + indicator
      const firstCommit = selectedCommits[0]
      const branchFromCommit = firstCommit?.subject
        ? formatCommitMessageToBranchName(firstCommit.subject, config)
        : ""
      const additionalCount = selectedCommits.length - 1
      const baseBranchName = branchFromCommit
        ? `${branchFromCommit}-plus-${additionalCount}-more`
        : `glu/tmp/${range}`
      targetBranch = config.branchPrefix
        ? `${config.branchPrefix}${baseBranchName}`
        : baseBranchName
    }

    console.log(`Creating branch ${targetBranch} from ${originBranch}...`)

    // Check if branch already exists
    try {
      await git.revparse(["--verify", targetBranch])
      if (options.force) {
        console.log(`Branch ${targetBranch} exists, deleting...`)
        await git.deleteLocalBranch(targetBranch, true)
      } else {
        console.error(
          `Branch ${targetBranch} already exists. Use --force to overwrite.`
        )
        process.exit(1)
      }
    } catch {
      // Branch doesn't exist, which is fine
    }

    // Create new branch from origin branch
    await git.checkoutBranch(targetBranch, originBranch)

    // Cherry-pick selected commits
    console.log(
      `Cherry-picking ${selectedCommits.length} commit(s) from range ${range}...`
    )
    for (const commit of selectedCommits) {
      try {
        await git.raw(["cherry-pick", commit.hash])
        console.log(`✓ Cherry-picked ${commit.hash.substring(0, 7)}`)
      } catch (error) {
        console.error(
          `Failed to cherry-pick ${commit.hash.substring(0, 7)}: ${error}`
        )
        console.log("Resolve conflicts and run: git cherry-pick --continue")
        process.exit(1)
      }
    }

    // Push branch and set up tracking (unless --no-push is specified)
    if (options.push !== false) {
      console.log(`Pushing ${targetBranch} to origin...`)
      try {
        // execa is used to capture the output of github
        const pushResult = await execa(
          "git",
          ["push", "-u", "--force", "origin", targetBranch],
          {
            cwd: process.cwd(),
            all: true, // Capture both stdout and stderr
          }
        )

        const pushOutput = pushResult.all || ""
        console.log(`✅ Branch ${targetBranch} pushed to origin with tracking`)

        // Show remote messages (often contains PR creation URLs)
        if (pushOutput && pushOutput.trim()) {
          const lines = pushOutput.trim().split("\n")
          const remoteMessages = lines.filter(
            (line) =>
              line.includes("pull request") ||
              line.includes("merge request") ||
              line.includes("http") ||
              line.includes("https") ||
              line.includes("remote:")
          )

          if (remoteMessages.length > 0) {
            console.log("")
            remoteMessages.forEach((msg) => {
              console.log(msg.replace(/^remote:\s*/, ""))
            })
          }
        }
      } catch (error) {
        console.error(`Failed to push: ${error}`)
        process.exit(1)
      }
    } else {
      console.log(`✅ Branch ${targetBranch} created locally`)
      console.log(`To push: git push -u origin ${targetBranch}`)
    }

    // Switch back to original branch
    await git.checkout(currentBranch)

    console.log(`Branch ready for PR: ${targetBranch}`)
  } catch (error) {
    console.error("Error:", error)
    process.exit(1)
  }
}

function formatCommitMessageToBranchName(message: string, config: any): string {
  let formatted = message.toLowerCase()

  // Remove conventional commit prefixes from config
  if (config.conventionalCommits?.stripPrefixes) {
    for (const prefix of config.conventionalCommits.stripPrefixes) {
      const regex = new RegExp(
        `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`,
        "i"
      )
      formatted = formatted.replace(regex, "")
    }
  }

  return formatted
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, config.formatting?.separator || "-") // Replace spaces with separator
    .replace(/-+/g, config.formatting?.separator || "-") // Replace multiple separators with single
    .replace(/^-|-$/g, "") // Remove leading/trailing separators
    .slice(0, config.formatting?.maxBranchLength || 50) // Limit length
}
