import type {
  GraphData,
  GraphStorageAdapter,
} from "../infrastructure/graph-storage-adapter.js"

export interface BranchLocation {
  branch: string
  commitHash: string
  status: "unpushed" | "pushed"
  remote?: string
  pushedAt?: Date
}

export interface CommitTracking {
  gluId: string
  firstSeen: Date
  locations: BranchLocation[]
}

export class GluGraphService {
  constructor(private storage: GraphStorageAdapter) {}

  async recordCommitLocation(
    gluId: string,
    branch: string,
    commitHash: string
  ): Promise<void> {
    const data = await this.storage.load()

    if (!data.commits[gluId]) {
      data.commits[gluId] = {
        firstSeen: new Date().toISOString(),
        locations: [],
      }
    }

    const existingLocation = data.commits[gluId]!.locations.find(
      (loc) => loc.branch === branch && loc.commitHash === commitHash
    )

    if (!existingLocation) {
      data.commits[gluId]!.locations.push({
        branch,
        commitHash,
        status: "unpushed",
      })
    }
    await this.storage.save(data)
  }

  async markBranchPushed(
    branch: string,
    remote: string,
    timestamp?: Date
  ): Promise<void> {
    const data = await this.storage.load()
    const pushedAt = (timestamp || new Date()).toISOString()

    for (const gluId in data.commits) {
      const commit = data.commits[gluId]!
      for (const location of commit.locations) {
        if (location.branch === branch) {
          location.status = "pushed"
          location.remote = remote
          location.pushedAt = pushedAt
        }
      }
    }

    await this.storage.save(data)
  }

  async getBranchesForGluId(gluId: string): Promise<BranchLocation[]> {
    const data = await this.storage.load()
    const commit = data.commits[gluId]

    if (!commit) {
      return []
    }

    return commit.locations.map((loc) => ({
      branch: loc.branch,
      commitHash: loc.commitHash,
      status: loc.status,
      remote: loc.remote,
      pushedAt: loc.pushedAt ? new Date(loc.pushedAt) : undefined,
    }))
  }

  async getGluIdsOnBranch(branch: string): Promise<string[]> {
    const data = await this.storage.load()
    const gluIds: string[] = []

    for (const [gluId, commit] of Object.entries(data.commits)) {
      const hasLocation = commit.locations.some((loc) => loc.branch === branch)
      if (hasLocation) {
        gluIds.push(gluId)
      }
    }

    return gluIds
  }

  async getAllTrackedCommits(): Promise<Map<string, CommitTracking>> {
    const data = await this.storage.load()
    const result = new Map<string, CommitTracking>()

    for (const [gluId, commit] of Object.entries(data.commits)) {
      result.set(gluId, {
        gluId,
        firstSeen: new Date(commit.firstSeen),
        locations: commit.locations.map((loc) => ({
          branch: loc.branch,
          commitHash: loc.commitHash,
          status: loc.status,
          remote: loc.remote,
          pushedAt: loc.pushedAt ? new Date(loc.pushedAt) : undefined,
        })),
      })
    }

    return result
  }

  async pruneDeletedBranches(existingBranches: string[]): Promise<number> {
    const data = await this.storage.load()
    const branchSet = new Set(existingBranches)
    let pruneCount = 0

    for (const gluId in data.commits) {
      const commit = data.commits[gluId]!
      const originalLength = commit.locations.length

      commit.locations = commit.locations.filter((loc) => {
        if (!branchSet.has(loc.branch)) {
          pruneCount++
          return false
        }
        return true
      })

      if (commit.locations.length === 0) {
        delete data.commits[gluId]
      }
    }

    await this.storage.save(data)
    return pruneCount
  }

  async export(): Promise<GraphData> {
    return await this.storage.load()
  }

  async import(data: GraphData): Promise<void> {
    await this.storage.save(data)
  }
}
