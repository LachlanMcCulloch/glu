export interface Commit {
  hash: string
  subject: string
  body: string
}

export interface CommitWithBranches extends Commit {
  branches: string[]
  gluId?: string
}

export interface Range {
  from: number
  to: number
  commits: Commit[]
}

export interface CommitComparison {
  ahead: number
  behind: number
  isAhead: boolean
  isBehind: boolean
  isUpToDate: boolean
}
