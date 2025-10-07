import { translateListError } from "./list-errors.js"
import { ListUseCase } from "../../use-cases/list-use-case.js"
import { ListCommitResultFormatter } from "./list-commit-result-formatter.js"

export async function listCommits() {
  const useCase = ListUseCase.default()

  try {
    const result = await useCase.execute()
    const formatted = ListCommitResultFormatter.format(result)
    formatted.forEach((line) => {
      console.log(line)
    })
  } catch (error) {
    const { message, exitCode } = translateListError(error as Error)
    console.error(message)
    process.exit(exitCode)
  }
}
