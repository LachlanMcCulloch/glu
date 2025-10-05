import type { GluConfig } from "./schema.js"

export const defaultConfig: GluConfig = {
  branchPrefix: "",
  defaultBranchFormat: "{prefix}{message}",
  conventionalCommits: {
    stripPrefixes: [
      "feat:",
      "feat(",
      "fix:",
      "fix(",
      "docs:",
      "docs(",
      "style:",
      "style(",
      "refactor:",
      "refactor(",
      "test:",
      "test(",
      "chore:",
      "chore(",
    ],
  },
  remote: {
    name: "origin",
    autoCreatePR: true,
  },
  formatting: {
    maxBranchLength: 50,
    separator: "-",
  },
  list: {
    showBranches: true,
    maxBranchesDisplayed: 5,
  },
}
