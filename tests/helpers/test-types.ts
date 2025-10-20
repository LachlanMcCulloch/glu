export interface TestRepo {
  path: string
  cleanup: () => Promise<void>
}

export interface CommitData {
  message: string
  files?: Record<string, string>
  author?: {
    name: string
    email: string
  }
  gluId?: string
}

export interface TestScenario {
  name: string
  commits: CommitData[]
  originAt: number // Index of commit where origin points
  currentBranch?: string

  // NEW: Support for behind commits
  originCommits?: CommitData[] // Additional commits that exist only on origin
  divergeAt?: number // Index where local and origin diverge
}

export interface TestResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface RunOptions {
  cwd?: string
  env?: Record<string, string>
  input?: string
  timeout?: number
}
