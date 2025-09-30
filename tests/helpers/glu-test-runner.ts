import { execa } from "execa"
import path from "path"
import type { TestResult, RunOptions } from "./test-types.js"

export class GluTestRunner {
  private gluPath: string

  constructor(gluPath?: string) {
    // Default to the built CLI in dist/
    this.gluPath = gluPath || path.resolve(process.cwd(), "dist/index.js")
  }

  async run(command: string[], options: RunOptions = {}): Promise<TestResult> {
    const { cwd = process.cwd(), env = {}, input, timeout = 30000 } = options

    try {
      const execaOptions: any = {
        cwd,
        env: { ...process.env, ...env },
        timeout,
        all: true,
        reject: false,
      }

      if (input !== undefined) {
        execaOptions.input = input
      }

      const result = await execa(
        "node",
        [this.gluPath, ...command],
        execaOptions
      )

      return {
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        exitCode: result.exitCode || 0,
      }
    } catch (error: any) {
      // Handle timeout and other execution errors
      if (error.timedOut) {
        throw new Error(
          `Command timed out after ${timeout}ms: node ${
            this.gluPath
          } ${command.join(" ")}`
        )
      }

      return {
        stdout: error.stdout || "",
        stderr: error.stderr || error.message || "",
        exitCode: error.exitCode || 1,
      }
    }
  }

  async expectSuccess(
    command: string[],
    options: RunOptions = {}
  ): Promise<string> {
    const result = await this.run(command, options)

    if (result.exitCode !== 0) {
      throw new Error(
        `Expected command to succeed but got exit code ${result.exitCode}\n` +
          `Command: glu ${command.join(" ")}\n` +
          `Stdout: ${result.stdout}\n` +
          `Stderr: ${result.stderr}`
      )
    }

    return result.stdout
  }

  async expectFailure(
    command: string[],
    expectedError?: string,
    options: RunOptions = {}
  ): Promise<void> {
    const result = await this.run(command, options)

    if (result.exitCode === 0) {
      throw new Error(
        `Expected command to fail but it succeeded\n` +
          `Command: glu ${command.join(" ")}\n` +
          `Stdout: ${result.stdout}`
      )
    }

    if (expectedError) {
      const output = result.stderr + result.stdout
      if (!output.includes(expectedError)) {
        throw new Error(
          `Expected error message "${expectedError}" not found in output\n` +
            `Command: glu ${command.join(" ")}\n` +
            `Actual output: ${output}`
        )
      }
    }
  }

  async captureOutput(
    command: string[],
    options: RunOptions = {}
  ): Promise<{ stdout: string; stderr: string }> {
    const result = await this.run(command, options)
    return {
      stdout: result.stdout,
      stderr: result.stderr,
    }
  }

  // Helper methods for common operations
  async ls(options: RunOptions = {}): Promise<TestResult> {
    return this.run(["ls"], options)
  }

  async requestReview(
    range: string,
    rrOptions: string[] = [],
    options: RunOptions = {}
  ): Promise<TestResult> {
    return this.run(["rr", range, ...rrOptions], options)
  }

  // Strip ANSI color codes for easier testing
  stripColors(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, "")
  }

  // Extract commit info from glu ls output
  parseListOutput(
    output: string
  ): Array<{ index: number; sha: string; message: string }> {
    const lines = this.stripColors(output).split("\n")
    const commits: Array<{ index: number; sha: string; message: string }> = []

    for (const line of lines) {
      // Match pattern like "  1  abc1234  Commit message"
      const match = line.match(/^\s*(\d+)\s+([a-f0-9]{7})\s+(.+)$/)
      if (match && match.length >= 4) {
        commits.push({
          index: parseInt(match[1]!),
          sha: match[2]!,
          message: match[3]!,
        })
      }
    }

    return commits
  }

  // Extract tracking info from glu ls output
  parseTrackingInfo(
    output: string
  ): { branch: string; origin: string; ahead: number; behind: number } | null {
    const firstLine = this.stripColors(output).split("\n")[0]
    // Match pattern like "feature-branch → origin/feature-branch [↑2 ↓0]"
    const match = firstLine?.match(/^(.+?)\s*→\s*(.+?)\s*\[↑(\d+)\s*↓(\d+)\]$/)

    if (match && match.length >= 5) {
      return {
        branch: match[1]!.trim(),
        origin: match[2]!.trim(),
        ahead: parseInt(match[3]!),
        behind: parseInt(match[4]!),
      }
    }

    return null
  }
}
