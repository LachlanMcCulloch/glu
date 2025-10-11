import { ApplicationError } from "./base-error.js"

export class ValidationError extends ApplicationError {
  readonly exitCode = 2

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context)
  }

  get userMessage(): string {
    return `❌ Validation failed: ${this.message}`
  }
}
