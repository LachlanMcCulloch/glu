import fs from "fs/promises"
import path from "path"

export interface GraphData {
  version: string
  commits: {
    [gluId: string]: {
      firstSeen: string
      locations: Array<{
        branch: string
        commitHash: string
        status: "unpushed" | "pushed"
        remote?: string
        pushedAt?: string
      }>
    }
  }
}

export interface GraphStorageAdapter {
  load(): Promise<GraphData>
  save(data: GraphData): Promise<void>
  exists(): Promise<boolean>
  initialize(): Promise<GraphData>
}

export class FileSystemGraphStorage implements GraphStorageAdapter {
  private readonly gluDir: string
  private readonly filePath: string

  constructor(baseDir: string = process.cwd()) {
    this.gluDir = path.join(baseDir, ".glu")
    this.filePath = path.join(this.gluDir, "graph.json")
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.filePath)
      return true
    } catch {
      return false
    }
  }

  async initialize(): Promise<GraphData> {
    const emptyGraph: GraphData = {
      version: "1.0.0",
      commits: {},
    }
    await this.ensureGluDirectory()
    await this.save(emptyGraph)
    return emptyGraph
  }

  async load(): Promise<GraphData> {
    try {
      const data = await fs.readFile(this.filePath, "utf-8")
      const parsed = JSON.parse(data) as GraphData

      if (!this.isValidGraphData(parsed)) {
        throw new Error("Invalid graph data format")
      }

      return parsed
    } catch (error) {
      if (await this.exists()) {
        await this.createBackup()
      }
      return await this.initialize()
    }
  }

  async save(data: GraphData): Promise<void> {
    await this.ensureGluDirectory()
    const json = JSON.stringify(data, null, 2)
    await fs.writeFile(this.filePath, json, "utf-8")
  }

  // MARK: Helpers

  async ensureGluDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.gluDir, { recursive: true })
    } catch (error) {
      if (error instanceof Error && !error.message.includes("EEXIST")) {
        throw error
      }
    }
  }

  async createBackup(): Promise<void> {
    const timestamp = Date.now()
    const backupPath = `${this.filePath}.backup.${timestamp}`
    try {
      await fs.copyFile(this.filePath, backupPath)
    } catch {
      // Ignore errors
    }
  }

  isValidGraphData(data: unknown): data is GraphData {
    if (typeof data !== "object" || data === null) return false

    const graph = data as Partial<GraphData>

    if (typeof graph.version !== "string") return false
    if (typeof graph.commits !== "object" || graph.commits === null) {
      return false
    }

    return true
  }
}
