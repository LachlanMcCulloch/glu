import { GluConfigFixture } from "@tests/helpers/glu-config-fixture.ts"
import { execa } from "execa"
import fs from "fs-extra"
import os from "os"
import path from "path"
import { describe, test, expect, beforeEach, afterEach } from "vitest"

describe("glu config", async () => {
  let tempDir: string
  let gluPath: string
  let configFixture: GluConfigFixture

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "glu-test-"))
    gluPath = path.resolve(process.cwd(), "dist/index.js")
    configFixture = new GluConfigFixture()
  })

  afterEach(async () => {
    await configFixture.cleanup()
    await fs.remove(tempDir)
  })

  // MARK: - Tests

  test("shows configuration help", async () => {
    const result = await execa("node", [gluPath, "config"], {
      cwd: tempDir,
      reject: false,
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("Usage: glu config [options] [command]")
    console.log(result.stderr)
  })
})
