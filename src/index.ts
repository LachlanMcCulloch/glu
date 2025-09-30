#!/usr/bin/env node

import { Command } from "commander";
import { requestReview } from "./commands/request-review.js";
import { listCommits } from "./commands/list.js";

const program = new Command();

program
  .name("glu")
  .description("Git stacked branch management CLI")
  .version("1.0.0");

program
  .command("ls")
  .description("List commits on current branch ahead of origin")
  .action(listCommits);

program
  .command("request-review <range>")
  .alias("rr")
  .description(
    'Create branch for PR from commit range (e.g., "1", "1-3", "2-2")'
  )
  .option(
    "-b, --branch <branch>",
    "Target branch name (defaults to glu/tmp/<range>)"
  )
  .option("--push", "Push branch to origin after creation")
  .option("--force", "Force push if branch already exists")
  .action(requestReview);

program.parse();
