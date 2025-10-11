import { ApplicationError } from "../core/errors/base-error.js"
import { UnexpectedError } from "../core/errors/unexpected-error.js"

export abstract class BaseCommand {
  public async execute(): Promise<void> {
    try {
      await this.run()
    } catch (error) {
      this.handleError(error)
    }
  }

  protected abstract run(): Promise<void>

  handleError(error: unknown): never {
    if (error instanceof ApplicationError) {
      console.error(error.userMessage)

      if (process.env.DEBUG) {
        console.error("\n🔍 Debug info:", {
          name: error.name,
          context: error.context,
          stack: error.stack,
        })
      }

      process.exit(error.exitCode)
    }

    const unexpected = new UnexpectedError(error as Error)
    console.error(unexpected.userMessage)

    if (process.env.DEBUG) {
      console.error("\n🔍 Debug info:", error)
    }

    process.exit(unexpected.exitCode)
  }
}
