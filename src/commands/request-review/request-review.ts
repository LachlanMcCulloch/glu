import ora from "ora"
import { RequestReviewUseCase } from "../../use-cases/request-review-use-case.js"
import { BaseCommand } from "../base-command.js"

interface RequestReviewOptions {
  branch?: string
  push?: boolean
}

export class RequestReviewCommand extends BaseCommand {
  constructor(
    private requestReviewUseCase: RequestReviewUseCase,
    private range: string,
    private options: RequestReviewOptions
  ) {
    super()
  }

  static create(
    range: string,
    options: RequestReviewOptions
  ): RequestReviewCommand {
    const requestReviewUseCase = RequestReviewUseCase.default()
    return new RequestReviewCommand(requestReviewUseCase, range, options)
  }

  protected async run(): Promise<void> {
    console.log(`Creating review branch from commits ${this.range}...\n`)
    const spinner = ora(
      `Creating review branch from range ${this.range}...`
    ).start()
    try {
      const result = await this.requestReviewUseCase.execute(
        this.range,
        this.options,
        {
          onValidatingWorkingDirectory: () => {
            spinner.text = "Validating working directory..."
          },
          onValidatingRange: () => {
            spinner.text = "Validating commit range..."
          },
          onCreatingStagingBranch: () => {
            spinner.text = "Creating staging branch..."
          },
          onCreatingReviewBranch: (branchName) => {
            spinner.text = `Creating review branch: ${branchName}`
          },
          onPushingBranch: (branchName) => {
            spinner.text = `Pushing ${branchName} to origin...`
          },
          onCleaningUp: () => {
            spinner.text = `Cleaning up...`
          },
        }
      )

      const successMessage =
        this.options.push === false
          ? `${result.branch} created locally`
          : `${result.branch} created and pushed`

      if (spinner.isSpinning) {
        spinner.succeed(successMessage)
      } else {
        console.log(`✓ ${successMessage}`)
      }

      console.log("\nCommits:")
      result.commits.forEach((commit) => {
        const shortMsg = commit.body.split("\n")[0]
        console.log(`  ${commit.hash.substring(0, 7)} - ${shortMsg}`)
      })

      if (result.pullRequestUrl) {
        console.log(`\n🔗 Create pull request: ${result.pullRequestUrl}`)
      }
    } catch (error) {
      spinner.stop()
      throw error
    }
  }
}
