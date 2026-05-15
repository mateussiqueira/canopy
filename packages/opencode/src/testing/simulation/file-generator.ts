import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs"
import os from "os"
import path from "path"

export interface Weights {
  readonly txt?: number
  readonly ts?: number
  readonly shallow?: number
  readonly deep?: number
  readonly editTxt?: number
  readonly editTs?: number
}

export interface GenerateFilesOptions {
  readonly seed?: number
  readonly count?: number
  readonly maxDepth?: number
  readonly maxWidth?: number
  readonly root?: string
  readonly weights?: Weights
}

export interface GeneratedFile {
  readonly path: string
  readonly kind: "txt" | "ts"
  readonly content: string
}

export interface GeneratedFiles {
  readonly seed: number
  readonly files: Record<string, string>
  readonly entries: readonly GeneratedFile[]
}

export interface GeneratePatchesOptions {
  readonly seed?: number
  readonly count?: number
  readonly patchDir?: string
  readonly weights?: Weights
}

export interface GeneratedPatch {
  readonly path: string
  readonly target: string
  readonly before: string
  readonly after: string
  readonly patch: string
}

export interface GeneratedPatches {
  readonly seed: number
  readonly files: Record<string, string>
  readonly patchedFiles: Record<string, string>
  readonly patches: readonly GeneratedPatch[]
}

type Random = () => number

const defaults = {
  txt: 1,
  ts: 1,
  shallow: 3,
  deep: 1,
  editTxt: 1,
  editTs: 1,
}

function random(seed: number): Random {
  let current = seed
  return () => {
    current = (current * 1664525 + 1013904223) >>> 0
    return current / 0x100000000
  }
}

function resolveSeed(value: number | undefined) {
  return value ?? Math.floor(Math.random() * 0xffffffff) + 1
}

function integer(rng: Random, min: number, max: number) {
  return min + Math.floor(rng() * (max - min + 1))
}

function pickWeighted<T extends string>(rng: Random, entries: readonly (readonly [T, number])[]) {
  const total = entries.reduce((sum, item) => sum + Math.max(0, item[1]), 0)
  const threshold = rng() * (total || entries.length)
  const picked = entries.reduce<{ value: T; remaining: number }>(
    (state, item) =>
      state.remaining <= 0 ? state : { value: item[0], remaining: state.remaining - Math.max(0, item[1]) },
    { value: entries[0][0], remaining: threshold },
  )
  return picked.remaining <= 0 ? picked.value : entries.at(-1)![0]
}

function slug(rng: Random) {
  const words = ["alpha", "bravo", "cedar", "delta", "ember", "field", "glade", "harbor", "iris", "juniper"]
  return `${words[integer(rng, 0, words.length - 1)]}-${integer(rng, 1, 99)}`
}

function generatedPath(
  rng: Random,
  input: { root: string; kind: "txt" | "ts"; maxDepth: number; maxWidth: number; weights: Weights },
) {
  const depthBias = pickWeighted(rng, [
    ["shallow", input.weights.shallow ?? defaults.shallow],
    ["deep", input.weights.deep ?? defaults.deep],
  ])
  const depth = depthBias === "shallow" ? integer(rng, 0, Math.min(1, input.maxDepth)) : integer(rng, 1, input.maxDepth)
  return path.posix.join(
    input.root,
    ...Array.from({ length: depth }, () => `dir-${integer(rng, 1, input.maxWidth)}`),
    `${slug(rng)}.${input.kind}`,
  )
}

function txtContent(rng: Random, name: string) {
  return Array.from(
    { length: integer(rng, 2, 6) },
    (_, index) => `${name} note ${index + 1}: ${slug(rng)} ${slug(rng)}.`,
  ).join("\n")
}

function tsContent(rng: Random, name: string) {
  const fn = name.replace(/[^a-zA-Z0-9]/g, "_")
  const templates = [
    () => [
      `export const ${fn}Value = ${integer(rng, 1, 100)}`,
      "",
      `export function ${fn}Message(input = \"${slug(rng)}\") {`,
      `  return \`${name}: \${input}\``,
      "}",
      "",
    ],
    () => [
      `export interface ${fn}Record {`,
      "  readonly id: string",
      "  readonly enabled: boolean",
      "  readonly tags: readonly string[]",
      "}",
      "",
      `export const ${fn}Records: readonly ${fn}Record[] = [`,
      `  { id: \"${slug(rng)}\", enabled: ${rng() > 0.5}, tags: [\"${slug(rng)}\", \"${slug(rng)}\"] },`,
      `  { id: \"${slug(rng)}\", enabled: ${rng() > 0.5}, tags: [] },`,
      "]",
      "",
      `export function ${fn}Enabled() {`,
      `  return ${fn}Records.filter((item) => item.enabled)`,
      "}",
      "",
    ],
    () => [
      `export type ${fn}Event =`,
      `  | { readonly type: \"created\"; readonly id: string; readonly count: number }`,
      `  | { readonly type: \"updated\"; readonly id: string; readonly fields: readonly string[] }`,
      `  | { readonly type: \"deleted\"; readonly id: string }`,
      "",
      `export function ${fn}Label(event: ${fn}Event) {`,
      `  if (event.type === \"created\") return \`created:\${event.id}:\${event.count}\``,
      `  if (event.type === \"updated\") return \`updated:\${event.id}:\${event.fields.length}\``,
      `  return \`deleted:\${event.id}\``,
      "}",
      "",
      `export const ${fn}Sample: ${fn}Event = { type: \"created\", id: \"${slug(rng)}\", count: ${integer(rng, 1, 20)} }`,
      "",
    ],
    () => [
      `const ${fn}Defaults = {`,
      `  retries: ${integer(rng, 1, 5)},`,
      `  timeout: ${integer(rng, 100, 900)},`,
      `  label: \"${slug(rng)}\",`,
      "} as const",
      "",
      `export async function load${fn}(input: Partial<typeof ${fn}Defaults> = {}) {`,
      `  const config = { ...${fn}Defaults, ...input }`,
      "  await Promise.resolve()",
      "  return {",
      "    ...config,",
      "    ready: config.retries > 0 && config.timeout > 0,",
      "  }",
      "}",
      "",
    ],
    () => [
      `export class ${fn}Store {`,
      "  #items = new Map<string, number>()",
      "",
      "  add(key: string, value: number) {",
      "    this.#items.set(key, (this.#items.get(key) ?? 0) + value)",
      "    return this",
      "  }",
      "",
      "  snapshot() {",
      "    return Object.fromEntries(this.#items.entries())",
      "  }",
      "}",
      "",
      `export const ${fn}StoreInstance = new ${fn}Store().add(\"${slug(rng)}\", ${integer(rng, 1, 10)})`,
      "",
    ],
    () => [
      `export const ${fn}Matrix = [`,
      `  [${integer(rng, 1, 9)}, ${integer(rng, 1, 9)}, ${integer(rng, 1, 9)}],`,
      `  [${integer(rng, 1, 9)}, ${integer(rng, 1, 9)}, ${integer(rng, 1, 9)}],`,
      "] as const",
      "",
      `export const ${fn}Total = ${fn}Matrix.flatMap((row) => row).reduce((sum, value) => sum + value, 0)`,
      "",
      `export const ${fn}Lookup = new Map<string, number>([`,
      `  [\"${slug(rng)}\", ${integer(rng, 10, 99)}],`,
      `  [\"${slug(rng)}\", ${integer(rng, 10, 99)}],`,
      "])",
      "",
    ],
  ]
  return templates[integer(rng, 0, templates.length - 1)]().join("\n")
}

function mutate(rng: Random, file: GeneratedFile) {
  const addHeavy = rng() > 0.5
  if (file.kind === "txt") {
    const lines = file.content.trimEnd().split("\n")
    const removeCount = Math.min(addHeavy ? integer(rng, 0, 1) : integer(rng, 2, 5), Math.max(0, lines.length - 1))
    const removed = new Set(Array.from({ length: removeCount }, () => integer(rng, 0, Math.max(0, lines.length - 1))))
    const editAt = integer(rng, 0, Math.max(0, lines.length - 1))
    const edited = lines
      .filter((_, index) => lines.length <= 1 || !removed.has(index))
      .map((line, index) => (index === editAt ? `${line} Extra detail: ${slug(rng)} ${slug(rng)}.` : line))
    return [
      ...edited,
      "",
      ...Array.from({ length: addHeavy ? integer(rng, 3, 6) : integer(rng, 0, 2) }, (_, index) =>
        [
          `## mutation ${integer(rng, 1, 999)}.${index + 1}`,
          `${slug(rng)} ${slug(rng)} ${slug(rng)}.`,
          `status=${rng() > 0.5 ? "active" : "pending"}`,
        ].join("\n"),
      ),
      "",
    ].join("\n")
  }

  const lines = file.content.trimEnd().split("\n")
  const removable = lines
    .map((line, index) => ({ line, index }))
    .filter((item) => item.line.trim() && !item.line.trim().endsWith("{") && !item.line.trim().startsWith("}"))
  const removeCount = Math.min(addHeavy ? integer(rng, 0, 2) : integer(rng, 3, 8), Math.max(0, removable.length - 1))
  const removed = new Set(
    Array.from({ length: removeCount }, () => removable[integer(rng, 0, removable.length - 1)]?.index).filter(
      (item): item is number => item !== undefined,
    ),
  )
  const renamed = lines
    .filter((_, index) => !removed.has(index))
    .map((line) =>
      line.includes("Value =") && rng() > 0.35 ? line.replace(/= \d+/, `= ${integer(rng, 101, 999)}`) : line,
    )
  const blocks = Array.from({ length: addHeavy ? integer(rng, 3, 6) : integer(rng, 0, 2) }, () => {
    const id = `generated${integer(rng, 100, 999)}`
    const templates = [
      () => [
        `export const ${id}Config = {`,
        `  id: "${slug(rng)}",`,
        `  retries: ${integer(rng, 1, 5)},`,
        `  flags: ["${slug(rng)}", "${slug(rng)}"],`,
        "} as const",
      ],
      () => [
        `export function ${id}Normalize(input: readonly string[]) {`,
        `  return input.map((item) => item.trim()).filter(Boolean).join("${rng() > 0.5 ? "," : "|"}")`,
        "}",
      ],
      () => [
        `export type ${id}State =`,
        `  | { readonly ok: true; readonly value: "${slug(rng)}" }`,
        `  | { readonly ok: false; readonly reason: "${slug(rng)}" }`,
      ],
      () => [
        `export const ${id}Items = [`,
        `  { key: "${slug(rng)}", value: ${integer(rng, 1, 50)} },`,
        `  { key: "${slug(rng)}", value: ${integer(rng, 1, 50)} },`,
        `  { key: "${slug(rng)}", value: ${integer(rng, 1, 50)} },`,
        "] as const",
      ],
    ]
    return templates[integer(rng, 0, templates.length - 1)]().join("\n")
  })
  const insertAt = rng() > 0.5 ? 0 : renamed.length
  return [
    ...renamed.slice(0, insertAt),
    "",
    ...blocks.flatMap((block) => [block, ""]),
    ...renamed.slice(insertAt),
    "",
  ].join("\n")
}

function gitPatch(file: string, before: string, after: string) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "opencode-simulation-diff-"))
  mkdirSync(path.join(dir, "a", path.dirname(file)), { recursive: true })
  mkdirSync(path.join(dir, "b", path.dirname(file)), { recursive: true })
  writeFileSync(path.join(dir, "a", file), before)
  writeFileSync(path.join(dir, "b", file), after)
  const result = Bun.spawnSync(["git", "-C", dir, "diff", "--no-index", "--no-prefix", "--", `a/${file}`, `b/${file}`])
  rmSync(dir, { recursive: true, force: true })
  if (result.exitCode > 1) throw new Error(new TextDecoder().decode(result.stderr))
  return new TextDecoder().decode(result.stdout)
}

function isGeneratedFiles(input: GeneratedFiles | Record<string, string>): input is GeneratedFiles {
  return Array.isArray(Reflect.get(input, "entries"))
}

export function generateFiles(options: GenerateFilesOptions = {}): GeneratedFiles {
  const resolvedSeed = resolveSeed(options.seed)
  const rng = random(resolvedSeed)
  const weights = { ...defaults, ...options.weights }
  const count = options.count ?? 12
  const maxDepth = Math.max(0, options.maxDepth ?? 3)
  const maxWidth = Math.max(1, options.maxWidth ?? 5)
  const root = options.root ?? "src"
  const entries = Array.from({ length: count }).reduce<GeneratedFile[]>((result) => {
    const kind = pickWeighted(rng, [
      ["txt", weights.txt],
      ["ts", weights.ts],
    ])
    const file = generatedPath(rng, { root, kind, maxDepth, maxWidth, weights })
    if (result.some((item) => item.path === file)) return result
    const name = path.posix.basename(file, path.posix.extname(file)).replace(/-/g, "_")
    return [...result, { path: file, kind, content: kind === "txt" ? txtContent(rng, name) : tsContent(rng, name) }]
  }, [])

  return {
    seed: resolvedSeed,
    entries,
    files: Object.fromEntries(entries.map((entry) => [entry.path, entry.content])),
  }
}

export function generatePatches(
  input: GeneratedFiles | Record<string, string>,
  options: GeneratePatchesOptions = {},
): GeneratedPatches {
  const resolvedSeed = resolveSeed(options.seed)
  const rng = random(resolvedSeed)
  const weights = { ...defaults, ...options.weights }
  const sourceEntries: GeneratedFile[] = isGeneratedFiles(input)
    ? [...input.entries]
    : Object.entries(input).map(([file, content]) => ({
        path: file,
        kind: file.endsWith(".ts") ? ("ts" as const) : ("txt" as const),
        content,
      }))
  const entries = sourceEntries
    .filter((entry) => entry.path.endsWith(".txt") || entry.path.endsWith(".ts"))
    .sort((a, b) => a.path.localeCompare(b.path))
  const selected = Array.from({ length: Math.min(options.count ?? 4, entries.length) }).reduce<GeneratedFile[]>(
    (result) => {
      const candidates = entries.filter((entry) => !result.some((item) => item.path === entry.path))
      if (candidates.length === 0) return result
      const targetKind = pickWeighted(rng, [
        ["txt", weights.editTxt],
        ["ts", weights.editTs],
      ])
      const preferred = candidates.filter((entry) => entry.kind === targetKind)
      return [
        ...result,
        (preferred.length ? preferred : candidates)[
          integer(rng, 0, (preferred.length ? preferred : candidates).length - 1)
        ],
      ]
    },
    [],
  )
  const patches = selected.map((entry, index) => {
    const after = mutate(rng, entry)
    const patch = gitPatch(entry.path, entry.content, after)
    return {
      path: path.posix.join(
        options.patchDir ?? ".simulation/patches",
        `${String(index + 1).padStart(3, "0")}-${path.posix.basename(entry.path)}.patch`,
      ),
      target: entry.path,
      before: entry.content,
      after,
      patch,
    }
  })

  return {
    seed: resolvedSeed,
    files: Object.fromEntries(patches.map((patch) => [patch.path, patch.patch])),
    patchedFiles: Object.fromEntries(patches.map((patch) => [patch.target, patch.after])),
    patches,
  }
}

export * as SimulationFileGenerator from "./file-generator"
