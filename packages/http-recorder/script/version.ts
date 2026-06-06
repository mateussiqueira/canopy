#!/usr/bin/env bun
import { $ } from "bun"
import { fileURLToPath } from "node:url"

const packages = await Array.fromAsync(
  new Bun.Glob("packages/**/package.json").scan({
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    absolute: true,
  }),
)
const ignored = (
  await Promise.all(packages.map(async (file) => (await Bun.file(file).json()) as { readonly name?: string }))
)
  .map((pkg) => pkg.name)
  .filter((name): name is string => name !== undefined && name !== "@opencode-ai/http-recorder")
  .flatMap((name) => ["--ignore", name])

await $`bunx changeset version ${ignored}`
