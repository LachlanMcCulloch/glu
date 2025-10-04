import { cosmiconfigSync } from "cosmiconfig"
import { writeFileSync } from "fs"
import path from "path"
import os from "os"
import type { GluConfig, PartialGluConfig } from "./schema.js"
import { defaultConfig } from "./defaults.js"

const moduleName = "glu"
const explorer = cosmiconfigSync(moduleName, {
  searchStrategy: "none",
})

// Cache for loaded config
let cachedConfig: GluConfig | null = null
let cachedConfigPath: string | null = null

/**
 * Load configuration from files with fallback to defaults
 */
export function loadConfig(): GluConfig {
  if (cachedConfig) {
    return cachedConfig
  }

  try {
    // Search from current directory first (project config), then home directory (user config)
    let projectResult = explorer.search()
    let userResult = null

    // If no project config found, search from home directory
    if (!projectResult) {
      userResult = explorer.search(os.homedir())
    }

    // Project config takes precedence over user config
    const finalResult = projectResult || userResult
    const finalConfig = finalResult?.config || {}

    // Cache the config path
    cachedConfigPath = finalResult?.filepath || null

    // Deep merge final config with defaults
    cachedConfig = mergeConfig(defaultConfig, finalConfig)
    return cachedConfig
  } catch (error) {
    console.warn(`Warning: Failed to load config, using defaults: ${error}`)
    cachedConfig = defaultConfig
    return cachedConfig
  }
}

/**
 * Get the user config file path (uses standard cosmiconfig location)
 */
function getUserConfigPath(): string {
  return path.join(os.homedir(), ".glurc")
}

/**
 * Save configuration to user config file
 */
export function saveConfig(config: PartialGluConfig): void {
  try {
    const configPath = getUserConfigPath()
    const currentConfig = loadConfig()
    const mergedConfig = mergeConfig(currentConfig, config)

    writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2))

    // Clear cache so next load picks up changes
    cachedConfig = null

    console.log(`Configuration saved to ${configPath}`)
  } catch (error) {
    console.error(`Failed to save config: ${error}`)
    process.exit(1)
  }
}

/**
 * Get a specific config value with dot notation support
 */
export function getConfigValue(key: string): any {
  const config = loadConfig()
  return getNestedValue(config, key)
}

/**
 * Set a specific config value with dot notation support
 */
export function setConfigValue(key: string, value: any): void {
  const currentConfig = loadConfig()
  const updatedConfig = setNestedValue(currentConfig, key, value)
  saveConfig(updatedConfig)
}

/**
 * Deep merge two config objects
 */
export function mergeConfig(
  base: GluConfig,
  override: PartialGluConfig
): GluConfig {
  const result = { ...base }

  for (const [key, value] of Object.entries(override)) {
    if (value !== undefined) {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const baseValue = result[key as keyof GluConfig]
        if (typeof baseValue === "object" && baseValue !== null) {
          result[key as keyof GluConfig] = {
            ...baseValue,
            ...value,
          } as any
        } else {
          result[key as keyof GluConfig] = value as any
        }
      } else {
        result[key as keyof GluConfig] = value as any
      }
    }
  }

  return result
}

/**
 * Get nested value using dot notation (e.g., "remote.name")
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj)
}

/**
 * Set nested value using dot notation
 */
function setNestedValue(obj: any, path: string, value: any): any {
  const keys = path.split(".")
  const result = JSON.parse(JSON.stringify(obj)) // Deep clone

  let current = result
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!
    if (!(key in current) || typeof current[key] !== "object") {
      current[key] = {}
    }
    current = current[key]
  }

  current[keys[keys.length - 1]!] = value
  return result
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): void {
  saveConfig(defaultConfig)
  console.log("Configuration reset to defaults")
}

/**
 * Get the path of the currently loaded config file
 */
export function getConfigPath(): string | null {
  loadConfig() // Ensure config is loaded
  return cachedConfigPath
}

/**
 * Clear config cache (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null
  cachedConfigPath = null
}
