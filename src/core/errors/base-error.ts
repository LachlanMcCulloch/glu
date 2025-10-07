export abstract class ApplicationError extends Error {
  abstract readonly exitCode: number
  abstract readonly userMessage: string

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = this.constructor.name
  }
}
