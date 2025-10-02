#!/usr/bin/env node

import { Command } from "commander"
import { requestReview } from "./commands/request-review.js"
import { listCommits } from "./commands/list.js"
import {
  configGet,
  configSet,
  configReset,
  configList,
  configPath,
} from "./commands/config.js"

const program = new Command()

program
  .name("glu")
  .description("Git stacked branch management CLI")
  .version("1.0.0")

// MARK: - List

program
  .command("ls")
  .description("List commits on current branch ahead of origin")
  .action(listCommits)

// MARK: - Request Review

program
  .command("request-review <range>")
  .alias("rr")
  .description(
    'Create and push branch for PR from commit range (e.g., "1", "1-3", "2-2")'
  )
  .option(
    "-b, --branch <branch>",
    "Target branch name (defaults to glu/tmp/<range>)"
  )
  .option("--force", "Force overwrite if branch already exists")
  .option("--no-push", "Create branch locally without pushing to origin")
  .action(requestReview)

// MARK: - Config

const configCmd = program
  .command("config")
  .description("Manage glu configuration")

configCmd
  .command("get [key]")
  .description("Get configuration value(s)")
  .action(configGet)

configCmd
  .command("set <key> <value>")
  .description("Set configuration value")
  .action(configSet)

configCmd
  .command("list")
  .description("List all configuration values")
  .action(configList)

configCmd
  .command("reset")
  .description("Reset configuration to defaults")
  .action(configReset)

configCmd
  .command("path")
  .description("Show the path of the currently loaded config file")
  .action(configPath)

program.parse()
