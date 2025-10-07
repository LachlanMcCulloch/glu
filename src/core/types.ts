export interface Commit {
  hash: string
  subject: string
  body: string
}

export interface IndexedCommit extends Commit {
  gluIndex: number
}

export interface CommitWithBranches extends Commit {
  branches: string[]
  gluId?: string
}

export interface ParsedRange {
  startIndex: number // 0-based
  endIndex: number // 0-based
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

export interface Branch {
  name: string
  isRemote: boolean
  upstream: string | null
}

export interface WorkingDirectoryStatus {
  isClean: boolean
  modified: string[]
  staged: string[]
  created: string[]
  deleted: string[]
  untracked: string[]
  conflicted: string[]
}
