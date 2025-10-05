export interface GluConfig {
  branchPrefix?: string
  defaultBranchFormat?: string
  conventionalCommits?: {
    stripPrefixes?: string[]
  }
  remote?: {
    name?: string
    autoCreatePR?: boolean
  }
  formatting?: {
    maxBranchLength?: number
    separator?: string
  }
  list?: {
    showBranches?: boolean
    maxBranchesDisplayed?: number
  }
}

export type PartialGluConfig = Partial<GluConfig>
