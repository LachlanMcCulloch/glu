import chalk from "chalk"
import { type ListResult } from "../../use-cases/list-use-case.js"

const arrow = chalk.gray("→")

const BRANCH_COLORS = [
  chalk.blue,
  chalk.yellowBright,
  chalk.magenta,
  chalk.greenBright,
  chalk.cyanBright,
  chalk.red,
  chalk.blueBright,
  chalk.yellow,
  chalk.magentaBright,
  chalk.green,
  chalk.cyan,
  chalk.redBright,
] as const

export class ListCommitResultFormatter {
  static format(input: ListResult): string[] {
    const headline = formatHeadline(input)
    const commits = formatCommits(input)
    return [
      headline,
      "", // Empty new line
      ...commits,
    ]
  }
}

// MARK: - Helper Functions

const branchColorMap = new Map<string, (typeof BRANCH_COLORS)[number]>()
let nextColorIndex = 0

function getBranchColor(branchName: string): (typeof BRANCH_COLORS)[number] {
  if (!branchColorMap.has(branchName)) {
    branchColorMap.set(
      branchName,
      BRANCH_COLORS[nextColorIndex % BRANCH_COLORS.length]!
    )
    nextColorIndex++
  }
  return branchColorMap.get(branchName)!
}

export function formatHeadline(input: ListResult): string {
  const fmtAhead =
    input.ahead > 0 ? chalk.green(`↑${input.ahead}`) : chalk.gray("↑0")
  const fmtBehind =
    input.behind > 0 ? chalk.red(`↓${input.behind}`) : chalk.gray("↓0")
  return `${chalk.cyan(input.currentBranch)} ${arrow} ${chalk.cyan(input.originBranch)} [${fmtAhead} ${fmtBehind}]`
}

export function formatCommits(input: ListResult): string[] {
  if (input.ahead === 0) {
    return [`No commits found ahead of ${input.originBranch}`]
  }

  const commitOrdered = input.unpushedCommits.reverse()

  const fmtCommits = commitOrdered.map((commit, index) => {
    const shortSha = commit.hash.substring(0, 7)
    const message =
      commit.subject.length > 60
        ? commit.subject.substring(0, 57) + "..."
        : commit.subject

    // TODO: Make concrete type to avoid this
    let branchInfo = ""
    if (commit.trackedBranches) {
      branchInfo = formatBranchTracking(commit.trackedBranches)
    }

    return `  ${chalk.cyan(commit.gluIndex)}  ${chalk.yellow(shortSha)}  ${message}${branchInfo}`
  })
  return fmtCommits
}

function formatBranchTracking(branches: string[]): string {
  if (branches.length === 0) {
    return ""
  }
  const branchList = branches
    .map((b) => getBranchColor(b)(b))
    .join(chalk.gray(", "))

  return ` ${chalk.gray("●")} ${branchList}`
}
