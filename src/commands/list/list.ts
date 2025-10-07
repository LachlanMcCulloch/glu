import { ListUseCase } from "../../use-cases/list-use-case.js"
import { ListCommitResultFormatter } from "./list-commit-result-formatter.js"
import { BaseCommand } from "../base-command.js"

export class ListCommand extends BaseCommand {
  constructor(private listUseCase: ListUseCase) {
    super()
  }

  static create(): ListCommand {
    const listUseCase = ListUseCase.default()
    return new ListCommand(listUseCase)
  }

  protected async run(): Promise<void> {
    const result = await this.listUseCase.execute()
    const formatted = ListCommitResultFormatter.format(result)
    formatted.forEach((line) => {
      console.log(line)
    })
  }
}

// export async function listCommits() {
//   const useCase = ListUseCase.default()

//   try {
//     const result = await useCase.execute()
//     const formatted = ListCommitResultFormatter.format(result)
//     formatted.forEach((line) => {
//       console.log(line)
//     })
//   } catch (error) {
//     const { message, exitCode } = translateListError(error as Error)
//     console.error(message)
//     process.exit(exitCode)
//   }
// }
