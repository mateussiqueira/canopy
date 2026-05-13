import { describe, expect } from "bun:test"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import { Effect, Exit } from "effect"
import path from "path"
import { SimulationFileSystem } from "../../../src/testing/simulation/filesystem"
import { testEffect } from "../../lib/effect"

const root = "/simulation"
const it = testEffect(
  SimulationFileSystem.layer({
    root,
    files: {
      "opencode.json": JSON.stringify({ model: "test/model" }),
      "README.md": "hello",
      "src/index.ts": "export const value = 1\n",
      "src/data.json": JSON.stringify({ ok: true }),
    },
  }),
)

describe("SimulationFileSystem", () => {
  it.effect("reads seeded files and writes nested files", () =>
    Effect.gen(function* () {
      const fs = yield* AppFileSystem.Service

      expect(yield* fs.readFileString(path.join(root, "README.md"))).toBe("hello")
      yield* fs.writeWithDirs(path.join(root, "tmp", "result.txt"), "done")

      expect(yield* fs.readFileString(path.join(root, "tmp", "result.txt"))).toBe("done")
      expect(yield* fs.isDir(path.join(root, "tmp"))).toBe(true)
      expect(yield* fs.isFile(path.join(root, "tmp", "result.txt"))).toBe(true)
    }),
  )

  it.effect("lists directory entries and globs in memory", () =>
    Effect.gen(function* () {
      const fs = yield* AppFileSystem.Service

      expect(yield* fs.readDirectoryEntries(path.join(root, "src"))).toEqual([
        { name: "data.json", type: "file" },
        { name: "index.ts", type: "file" },
      ])
      expect(yield* fs.glob("**/*.ts", { cwd: root })).toEqual(["src/index.ts"])
      expect(yield* fs.globUp("*.md", path.join(root, "src"), root)).toEqual([path.join(root, "README.md")])
    }),
  )

  it.effect("denies paths outside the simulated root", () =>
    Effect.gen(function* () {
      const fs = yield* AppFileSystem.Service
      const exit = yield* fs.readFileString("/etc/passwd").pipe(Effect.exit)

      expect(Exit.isFailure(exit)).toBe(true)
    }),
  )
})
