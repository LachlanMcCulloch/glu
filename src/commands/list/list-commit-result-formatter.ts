import chalk from "chalk"
import { type ListResult } from "../../use-cases/list-use-case.js"

export class ListCommitResultFormatter {
  private static arrow: string = chalk.gray("→")

  private static formatHeadline(input: ListResult): string {
    const fmtAhead =
      input.ahead > 0 ? chalk.green(`↑${input.ahead}`) : chalk.gray("↑0")
    const fmtBehind =
      input.behind > 0 ? chalk.red(`↓${input.behind}`) : chalk.gray("↓0")
    return `${chalk.cyan(input.currentBranch)} ${this.arrow} ${chalk.cyan(input.originBranch)} [${fmtAhead} ${fmtBehind}]`
  }

  private static formatCommits(input: ListResult): string[] {
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

      return `  ${chalk.cyan(commit.gluIndex)}  ${chalk.yellow(shortSha)}  ${message}`
    })
    return fmtCommits
  }

  static format(input: ListResult): string[] {
    const headline = this.formatHeadline(input)
    const commits = this.formatCommits(input)
    return [
      headline,
      "", // Empty new line
      ...commits,
    ]
  }
}
