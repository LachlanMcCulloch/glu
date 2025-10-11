import { ApplicationError } from "./base-error.js"

export class UnexpectedError extends ApplicationError {
  readonly exitCode = 1

  constructor(originalError: Error) {
    super(originalError.message, { originalError })
  }

  get userMessage(): string {
    return `❌ An unexpected error occurred: ${this.message}`
  }
}
