#!/usr/bin/env node --no-warnings=ExperimentalWarning

/*
 * glu - Git stacked commit management
 * Copyright (C) 2024 Lachlan McCulloch
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Command } from "commander"
import { RequestReviewCommand } from "./commands/request-review/request-review.js"
import { ListCommand } from "./commands/list/list.js"
import {
  configGet,
  configSet,
  configReset,
  configList,
  configPath,
} from "./commands/config.js"

// Handle packaging version
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const packageJson = require("../package.json")

const program = new Command()

program
  .name("glu")
  .description("Git stacked branch management CLI")
  .version(packageJson.version, "-v, --version", "output the version number")

// MARK: - List

program
  .command("ls")
  .description("List commits on current branch ahead of origin")
  .action(async () => {
    const command = ListCommand.create()
    await command.execute()
  })

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
  .option("--no-push", "Create branch locally without pushing to origin")
  .action(
    async (range: string, options: { branch?: string; push?: boolean }) => {
      const command = RequestReviewCommand.create(range, options)
      await command.execute()
    }
  )

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
