#!/usr/bin/env bun

import { SimulationFileGenerator } from "./file-generator"

function arg(name: string) {
  const prefix = `--${name}=`
  return Bun.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length)
}

function numberArg(name: string, fallback: number) {
  const value = Number(arg(name))
  return Number.isFinite(value) ? value : fallback
}

function weight(name: string) {
  const value = Number(arg(name))
  return Number.isFinite(value) ? value : undefined
}

const generated = SimulationFileGenerator.generateFiles({
  seed: numberArg("seed", Math.random() * 10000 | 0),
  count: numberArg("count", 10),
  maxDepth: numberArg("max-depth", 3),
  maxWidth: numberArg("max-width", 5),
  root: arg("root") ?? "src",
  weights: {
    txt: weight("txt"),
    ts: weight("ts"),
    shallow: weight("shallow"),
    deep: weight("deep"),
  },
})

const patches = SimulationFileGenerator.generatePatches(generated, {
  seed: numberArg("patch-seed", numberArg("seed", 1) + 1),
  count: numberArg("patch-count", 3),
  patchDir: arg("patch-dir") ?? ".simulation/patches",
  weights: {
    editTxt: weight("edit-txt"),
    editTs: weight("edit-ts"),
  },
})

if (Bun.argv.includes("--json")) {
  console.log(JSON.stringify({ generated, patches }, null, 2))
  process.exit(0)
}

console.log(`seed: ${generated.seed}`)
console.log(`files: ${generated.entries.length}`)
for (const entry of generated.entries) {
  console.log(`${entry.path}: ${entry.content}\n`)
}

console.log(`\npatch seed: ${patches.seed}`)
console.log(`patches: ${patches.patches.length}`)
for (const patch of patches.patches) {
  console.log('--------------------------------------------------------------------')
  console.log(patch.patch)
}

console.log("\nTry: bun src/testing/simulation/file-generator.play.ts --seed=42 --count=5 --ts=4 --txt=1 --deep=3")
console.log("JSON: bun src/testing/simulation/file-generator.play.ts --json")
