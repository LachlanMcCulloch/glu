import chalk from "chalk"
import { GitAdapter } from "../infrastructure/git-adapter.js"
import { GitCommitRepository } from "../core/commit-repository.js"
import { BranchStatusService } from "../services/branch-status-service.js"
import { translateListError } from "./list-errors.js"

export async function listCommits() {
  const gitAdapter = new GitAdapter()
  const commitRepository = new GitCommitRepository(gitAdapter)
  const branchStatusService = new BranchStatusService(commitRepository)

  try {
    const unpushedCommits = await commitRepository.getUnpushedCommits()
    const branchStatus = await branchStatusService.getCurrentBranchStatus()

    const aheadCount = branchStatus.comparison.ahead
    const behindCount = branchStatus.comparison.behind
    const currentBranch = branchStatus.localBranch
    const originBranch = branchStatus.remoteBranch

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

    unpushedCommits.forEach((commit, index) => {
      const shortSha = commit.hash.substring(0, 7)
      const message =
        commit.subject.length > 60
          ? commit.subject.substring(0, 57) + "..."
          : commit.subject

      const paddedIndex = (unpushedCommits.length - index)
        .toString()
        .padStart(2)
      console.log(
        `  ${chalk.cyan(paddedIndex)}  ${chalk.yellow(shortSha)}  ${message}`
      )
    })
  } catch (error) {
    const { message, exitCode } = translateListError(error as Error)
    console.error(message)
    process.exit(exitCode)
  }
}
