#!/usr/bin/env node

import { simpleGit } from "simple-git"
import fs from "fs-extra"
import path from "path"
import os from "os"
import chalk from "chalk"

// TODO: Use shared functionality from tests GitFixture. Will require creating a shared package
async function createTestStack() {
  const tempPath = await fs.mkdtemp(path.join(os.tmpdir(), "glu-manual-test-"))
  const git = simpleGit(tempPath)

  console.log(chalk.magenta(`Creating test stack in: ${tempPath}\n`))

  await git.init()
  await git.addConfig("user.name", "Test User")
  await git.addConfig("user.email", "test@example.com")
  await git.checkoutLocalBranch("main")

  await fs.writeFile(path.join(tempPath, "README.md"), "# Test Project\n")
  await git.add(".")
  const result = await git.commit("Initial commit")

  await git.addRemote("origin", "https://github.com/test/test-repo.git")
  const refPath = path.join(tempPath, ".git", "refs", "remotes", "origin")
  await fs.ensureDir(refPath)
  await fs.writeFile(path.join(refPath, "main"), result.commit + "\n")
  await git.addConfig("branch.main.remote", "origin")
  await git.addConfig("branch.main.merge", "refs/heads/main")

  await fs.writeFile(
    path.join(tempPath, "feature-a.js"),
    'export const featureA = () => "A";\n'
  )
  await git.add(".")
  await git.commit("Add feature A")
  await git.branch(["feature-a"])
  await git.branch(["branch-alpha"])

  await fs.writeFile(
    path.join(tempPath, "feature-b.js"),
    'export const featureB = () => "B";\n'
  )
  await git.add(".")
  await git.commit("Add feature B")
  await git.branch(["feature-b"])

  await fs.writeFile(
    path.join(tempPath, "feature-c.js"),
    'export const featureC = () => "C";\n'
  )
  await git.add(".")
  await git.commit("Add feature C")
  await git.branch(["feature-c"])
  await git.branch(["another-branch-c"])

  console.log(chalk.green("✓ Test stack created successfully!\n"))
  console.log(chalk.bold("Location:"), chalk.yellow(tempPath))
  console.log(chalk.bold("\nTo test:"))
  console.log(chalk.cyan("  cd " + tempPath))
  console.log(
    chalk.cyan("  node /Users/wraeth/projects/lmcculloch/glu/dist/index.js ls")
  )
  console.log(chalk.bold("\nOr run directly:"))
  console.log(
    chalk.cyan(
      `  (cd ${tempPath} && node /Users/wraeth/projects/lmcculloch/glu/dist/index.js ls)`
    )
  )
  console.log(chalk.bold("\nCleanup:"))
  console.log(chalk.cyan(`  rm -rf ${tempPath}`))
}

createTestStack().catch(console.error)
