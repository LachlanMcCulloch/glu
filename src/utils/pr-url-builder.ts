// TODO: Allow custom Git URL from config
export function buildPullRequestUrl(
  remoteUrl: string,
  branch: string
): string | null {
  // GitHub (SSH)
  let match = remoteUrl.match(/git@github\.com:(.+?)\/(.+?)(\.git)?$/)
  if (match) {
    const [, owner, repo] = match
    return `https://github.com/${owner}/${repo}/pull/new/${branch}`
  }

  // GitHub (HTTPS)
  match = remoteUrl.match(/https:\/\/github\.com\/(.+?)\/(.+?)(\.git)?$/)
  if (match) {
    const [, owner, repo] = match
    return `https://github.com/${owner}/${repo}/pull/new/${branch}`
  }

  // GitLab
  match = remoteUrl.match(
    /(?:git@|https:\/\/)gitlab\.com[:/](.+?)\/(.+?)(\.git)?$/
  )
  if (match) {
    const [, owner, repo] = match
    const encodedBranch = encodeURIComponent(branch)
    return `https://gitlab.com/${owner}/${repo}/-/merge_requests/new?merge_request[source_branch]=${encodedBranch}`
  }

  // Bitbucket
  match = remoteUrl.match(
    /(?:git@|https:\/\/)bitbucket\.org[:/](.+?)\/(.+?)(\.git)?$/
  )
  if (match) {
    const [, owner, repo] = match
    return `https://bitbucket.org/${owner}/${repo}/pull-requests/new?source=${branch}`
  }

  return null
}
