import { describe, expect, test } from "bun:test"
import { parsePatch } from "diff"
import { SimulationFileGenerator } from "../../../src/testing/simulation/file-generator"

describe("SimulationFileGenerator", () => {
  test("generates deterministic txt and ts files", () => {
    const first = SimulationFileGenerator.generateFiles({ seed: 42, count: 8 })
    const second = SimulationFileGenerator.generateFiles({ seed: 42, count: 8 })

    expect(first).toEqual(second)
    expect(first.entries.length).toBe(8)
    expect(first.entries.some((entry) => entry.kind === "txt")).toBe(true)
    expect(first.entries.some((entry) => entry.kind === "ts")).toBe(true)
    expect(Object.keys(first.files)).toEqual(first.entries.map((entry) => entry.path))
  })

  test("uses weights to steer file kind and tree depth", () => {
    const generated = SimulationFileGenerator.generateFiles({
      seed: 7,
      count: 6,
      maxDepth: 4,
      weights: { txt: 0, ts: 1, shallow: 0, deep: 1 },
    })

    expect(generated.entries.every((entry) => entry.kind === "ts")).toBe(true)
    expect(generated.entries.every((entry) => entry.path.split("/").length > 2)).toBe(true)
  })

  test("generates patch files for existing generated files", () => {
    const generated = SimulationFileGenerator.generateFiles({ seed: 3, count: 5 })
    const patches = SimulationFileGenerator.generatePatches(generated, { seed: 9, count: 3, patchDir: ".git/patches" })

    expect(patches.patches.length).toBe(3)
    expect(Object.keys(patches.files)).toEqual(patches.patches.map((patch) => patch.path))
    expect(Object.keys(patches.patchedFiles)).toEqual(patches.patches.map((patch) => patch.target))
    for (const patch of patches.patches) {
      expect(generated.files[patch.target]).toBe(patch.before)
      expect(patch.after).not.toBe(patch.before)
      expect(patch.path.startsWith(".git/patches/")).toBe(true)
      expect(patch.patch.startsWith(`diff --git a/${patch.target} b/${patch.target}`)).toBe(true)
      expect(parsePatch(patch.patch)[0].oldFileName).toBe(`a/${patch.target}`)
    }
  })
})
