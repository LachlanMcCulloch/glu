import { defaultConfig } from "@/config/defaults.ts"
import { mergeConfig } from "@/config/index.ts"
import type { GluConfig } from "@/config/schema.ts"
import path from "path"
import fs from "fs-extra"

export class GluConfigFixture {
  private filesToCleanup: Array<string> = []

  async createConfigFile(): Promise<void>
  async createConfigFile(type: "default"): Promise<void>
  async createConfigFile(type: "override", overrides: GluConfig): Promise<void>
  async createConfigFile(type: "custom", custom: GluConfig): Promise<void>

  async createConfigFile(
    type?: CreateConfigType,
    config?: GluConfig
  ): Promise<void> {
    switch (type) {
      case undefined:
      case "default":
        config = defaultConfig
      case "custom":
        if (!config) {
          throw new Error("Unexpected undefined config when type == 'custom'")
        }
        break // use config directly
      case "override":
        if (!config) {
          throw new Error("Unexpected undefined config when type == 'custom'")
        }
        config = mergeConfig(defaultConfig, config)
    }
    // TODO: Make path configurable
    const configPath = path.resolve(process.cwd(), ".glurc")
    fs.writeFileSync(configPath, JSON.stringify(config))
    this.filesToCleanup.push(configPath)
  }

  async cleanup() {
    for (const configPath of this.filesToCleanup) {
      fs.removeSync(configPath)
    }
  }

  // async createConfig(type: CreateConfigType): Promise<void> {
  //   //
  // }

  // async createConfig(type: 'override', overrides: {}): Promise<void> {
  //   //
  // }

  // async createConfig(type: 'custom', custom: {}): Promise<void> {
  //   //
  // }
}

type CreateConfigType = "default" | "override" | "custom"
