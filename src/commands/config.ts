import chalk from "chalk"
import {
  loadConfig,
  getConfigValue,
  setConfigValue,
  resetConfig,
  getConfigPath,
} from "../config/index.js"

export async function configGet(key?: string) {
  try {
    const config = loadConfig()

    if (key) {
      const value = getConfigValue(key)
      if (value !== undefined) {
        console.log(value)
      } else {
        console.error(`Configuration key '${key}' not found`)
        process.exit(1)
      }
    } else {
      // Display all config
      console.log(chalk.cyan("Current configuration:"))
      console.log(JSON.stringify(config, null, 2))
    }
  } catch (error) {
    console.error(`Error reading configuration: ${error}`)
    process.exit(1)
  }
}

export async function configSet(key: string, value: string) {
  try {
    // Parse value - try to detect type
    let parsedValue: any = value

    // Try to parse as JSON for objects/arrays/booleans/numbers
    if (value === "true") parsedValue = true
    else if (value === "false") parsedValue = false
    else if (value === "null") parsedValue = null
    else if (/^\d+$/.test(value)) parsedValue = parseInt(value, 10)
    else if (/^\d+\.\d+$/.test(value)) parsedValue = parseFloat(value)
    else if (value.startsWith("{") || value.startsWith("[")) {
      try {
        parsedValue = JSON.parse(value)
      } catch {
        // Keep as string if JSON parsing fails
      }
    }

    setConfigValue(key, parsedValue)
    console.log(chalk.green(`✅ Set ${key} = ${JSON.stringify(parsedValue)}`))
  } catch (error) {
    console.error(`Error setting configuration: ${error}`)
    process.exit(1)
  }
}

export async function configReset() {
  try {
    resetConfig()
    console.log(chalk.green("✅ Configuration reset to defaults"))
  } catch (error) {
    console.error(`Error resetting configuration: ${error}`)
    process.exit(1)
  }
}

export async function configList() {
  await configGet() // List all config
}

export async function configPath() {
  try {
    const configPath = getConfigPath()

    if (configPath) {
      console.log(chalk.cyan("Configuration loaded from:"))
      console.log(configPath)
    } else {
      console.log(chalk.yellow("No configuration file found, using defaults"))
      console.log(
        chalk.gray(
          "You can create a config file with: glu config set <key> <value>"
        )
      )
    }
  } catch (error) {
    console.error(`Error getting config path: ${error}`)
    process.exit(1)
  }
}
