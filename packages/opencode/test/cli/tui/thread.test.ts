import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import fs from "fs/promises"
import path from "path"
import { tmpdir } from "../../fixture/fixture"
import { cliIt } from "../../lib/cli-process"
import { resolveThreadDirectory } from "../../../src/cli/cmd/tui/thread"

describe("tui thread", () => {
  async function check(project?: string) {
    await using tmp = await tmpdir({ git: true })
    const link = path.join(path.dirname(tmp.path), path.basename(tmp.path) + "-link")
    const type = process.platform === "win32" ? "junction" : "dir"

    try {
      await fs.symlink(tmp.path, link, type)
      expect(resolveThreadDirectory(project, link, tmp.path)).toBe(tmp.path)
    } finally {
      await fs.rm(link, { recursive: true, force: true }).catch(() => undefined)
    }
  }

  test("uses the real cwd when PWD points at a symlink", async () => {
    await check()
  })

  test("uses the real cwd after resolving a relative project from PWD", async () => {
    await check(".")
  })

  cliIt.live("exits nonzero when a requested session ID is invalid", ({ opencode }) =>
    Effect.gen(function* () {
      const result = yield* opencode.spawn(["--session", "invalid", "--pure"])

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain("Invalid session ID")
    }),
  )
})
