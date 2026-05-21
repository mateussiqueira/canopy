#!/usr/bin/env bun
import { fileURLToPath } from "url"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

import { $ } from "bun"
import path from "path"

import { createClient } from "@hey-api/openapi-ts"

const opencode = path.resolve(dir, "../../opencode")

await $`bun dev generate > ${dir}/openapi.json`.cwd(opencode)
await Bun.write(path.join(dir, "openapi-legacy.json"), JSON.stringify(legacyOpenApi(await Bun.file("openapi.json").json())))

await createClient({
  input: "./openapi-legacy.json",
  output: {
    path: "./src/gen",
    tsConfigPath: path.join(dir, "tsconfig.json"),
    clean: true,
  },
  plugins: [
    {
      name: "@hey-api/typescript",
      exportFromIndex: false,
    },
    {
      name: "@hey-api/sdk",
      instance: "OpencodeClient",
      exportFromIndex: false,
      auth: false,
    },
    {
      name: "@hey-api/client-fetch",
      exportFromIndex: false,
      baseUrl: "http://localhost:4096",
    },
  ],
})

await createClient({
  input: "./openapi.json",
  output: {
    path: "./src/v2/gen",
    tsConfigPath: path.join(dir, "tsconfig.json"),
    clean: true,
  },
  plugins: [
    {
      name: "@hey-api/typescript",
      exportFromIndex: false,
    },
    {
      name: "@hey-api/sdk",
      instance: "OpencodeClient",
      exportFromIndex: false,
      auth: false,
      paramsStructure: "flat",
    },
    {
      name: "@hey-api/client-fetch",
      exportFromIndex: false,
      baseUrl: "http://localhost:4096",
    },
  ],
})

await $`bun prettier --write src/gen`
await $`bun prettier --write src/v2`
await $`rm -rf dist`
await $`bun tsc`
await $`rm openapi.json`
await $`rm openapi-legacy.json`

type OpenApiSpec = {
  paths: Record<string, Record<string, { parameters?: Array<{ name: string; in: string }> }>>
}

function legacyOpenApi(input: OpenApiSpec) {
  const spec = structuredClone(input)
  spec.paths = Object.fromEntries(
    Object.entries(spec.paths)
      .filter(([route]) => route !== "/api" && !route.startsWith("/api/"))
      .map(([route, item]) => [route.replaceAll("{sessionID}", "{id}"), renameLegacyPathParameters(item)]),
  )
  return spec
}

function renameLegacyPathParameters(item: OpenApiSpec["paths"][string]) {
  for (const operation of Object.values(item)) {
    for (const parameter of operation.parameters ?? []) {
      if (parameter.in === "path" && parameter.name === "sessionID") parameter.name = "id"
    }
  }
  return item
}
