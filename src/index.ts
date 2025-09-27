#!/usr/bin/env node

import { Command } from 'commander';
import { requestReview } from './commands/request-review.js';
import { listCommits } from './commands/list.js';

const program = new Command();

program
  .name('glu')
  .description('Git stacked branch management CLI')
  .version('1.0.0');

program
  .command('ls')
  .description('List commits on current branch ahead of main/master')
  .action(listCommits);

program
  .command('request-review')
  .alias('rr')
  .description('Create branch for PR from selected commits')
  .option('-c, --commits <commits>', 'Comma-separated commit indices (from glu ls)')
  .option('-b, --branch <branch>', 'Target branch name (defaults to <current>-review)')
  .option('--push', 'Push branch to origin after creation')
  .action(requestReview);

program.parse();
