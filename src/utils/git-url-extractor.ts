/**
 * Extracts pull request/merge request URLs from git push output
 */

export function extractPullRequestUrl(gitOutput: string): string | null {
  if (!gitOutput) return null

  const lines = gitOutput.split("\n")

  const remoteLines = lines.filter(
    (line) => line.trim().startsWith("remote:") && line.includes("http")
  )

  for (const line of remoteLines) {
    // Extract URLs that look like PR/MR creation URLs
    const urlMatch = line.match(/(https?:\/\/[^\s]+)/i)
    if (!urlMatch) continue

    const url = urlMatch[1]!

    // Check if URL contains PR/MR keywords
    const isPrUrl = /(?:pull|merge|request)/i.test(url)
    if (isPrUrl) {
      return url
    }
  }

  return null
}

// TODO: Move to tests
/**
 * Test data for common git hosting providers
 */
export const SAMPLE_GIT_OUTPUTS = {
  github: `
To github.com:user/repo.git
   abc123..def456  feature-branch -> feature-branch
remote: 
remote: Create a pull request for 'feature-branch' on GitHub by visiting:
remote:      https://github.com/user/repo/pull/new/feature-branch
remote: 
  `,

  gitlab: `
To gitlab.com:user/repo.git
   abc123..def456  feature-branch -> feature-branch
remote: 
remote: To create a merge request for feature-branch, visit:
remote:   https://gitlab.com/user/repo/-/merge_requests/new?merge_request%5Bsource_branch%5D=feature-branch
remote:
  `,

  bitbucket: `
To bitbucket.org:user/repo.git
   abc123..def456  feature-branch -> feature-branch
remote: 
remote: Create pull request for feature-branch:
remote:   https://bitbucket.org/user/repo/pull-requests/new?source=feature-branch
remote:
  `,

  azureDevOps: `
To dev.azure.com:org/project/_git/repo
   abc123..def456  feature-branch -> feature-branch
remote: Create a pull request for 'feature-branch' on Azure Repos:
remote:   https://dev.azure.com/org/project/_git/repo/pullrequestcreate?sourceRef=feature-branch
  `,

  noUrl: `
To origin
   abc123..def456  feature-branch -> feature-branch
  `,
}
