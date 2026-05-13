import { AppFileSystem } from "@opencode-ai/core/filesystem"
import { Glob } from "@opencode-ai/core/util/glob"
import { Effect, FileSystem, Layer, Option, Stream } from "effect"
import { badArgument, systemError, type PlatformError } from "effect/PlatformError"
import path from "path"

type Entry =
  | { readonly type: "directory"; readonly mode: number; readonly modified: Date }
  | { readonly type: "file"; readonly mode: number; readonly modified: Date; readonly content: Uint8Array }

export interface Options {
  readonly root: string
  readonly files?: Record<string, string | Uint8Array>
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const notFound = (method: string, file: string) =>
  systemError({
    _tag: "NotFound",
    module: "SimulationFileSystem",
    method,
    description: "No such file or directory",
    pathOrDescriptor: file,
  })

const alreadyExists = (method: string, file: string) =>
  systemError({
    _tag: "AlreadyExists",
    module: "SimulationFileSystem",
    method,
    description: "Path already exists",
    pathOrDescriptor: file,
  })

const permissionDenied = (method: string, file: string) =>
  systemError({
    _tag: "PermissionDenied",
    module: "SimulationFileSystem",
    method,
    description: "Path is outside the simulated filesystem root",
    pathOrDescriptor: file,
  })

const unsupported = (method: string) =>
  badArgument({
    module: "SimulationFileSystem",
    method,
    description: "Operation is not supported by the simulated filesystem",
  })

export function make(options: Options) {
  const root = path.resolve(options.root)
  const entries = new Map<string, Entry>()
  const temp = { value: 0 }

  const normalize = (method: string, file: string): string | PlatformError => {
    const resolved = path.resolve(root, file)
    if (resolved === root || AppFileSystem.contains(root, resolved)) return resolved
    return permissionDenied(method, file)
  }

  const touch = () => new Date(0)

  const ensureParentDirs = (file: string) => {
    const parent = path.dirname(file)
    if (parent === file) return
    if (entries.has(parent)) return
    ensureParentDirs(parent)
    entries.set(parent, { type: "directory", mode: 0o755, modified: touch() })
  }

  const entry = (method: string, file: string) => {
    const normalized = normalize(method, file)
    if (typeof normalized !== "string") return normalized
    return entries.get(normalized) ?? notFound(method, file)
  }

  const descendants = (dir: string) =>
    [...entries.keys()].filter((item) => item !== dir && AppFileSystem.contains(dir, item))

  const children = (dir: string) =>
    [...entries.keys()]
      .filter((item) => item !== dir && path.dirname(item) === dir)
      .sort((a, b) => path.basename(a).localeCompare(path.basename(b)))

  const writeBytes = (method: string, file: string, content: Uint8Array, mode?: number) => {
    const normalized = normalize(method, file)
    if (typeof normalized !== "string") return Effect.fail(normalized)
    const parent = entries.get(path.dirname(normalized))
    if (!parent) return Effect.fail(notFound(method, path.dirname(file)))
    if (parent.type !== "directory") return Effect.fail(notFound(method, path.dirname(file)))
    entries.set(normalized, { type: "file", mode: mode ?? 0o644, modified: touch(), content: content.slice() })
    return Effect.void
  }

  entries.set(root, { type: "directory", mode: 0o755, modified: touch() })
  for (const [file, content] of Object.entries(options.files ?? {})) {
    const normalized = normalize("seed", file)
    if (typeof normalized !== "string") continue
    ensureParentDirs(normalized)
    entries.set(normalized, {
      type: "file",
      mode: 0o644,
      modified: touch(),
      content: typeof content === "string" ? encoder.encode(content) : content.slice(),
    })
  }

  const base = FileSystem.make({
    access: (file) =>
      Effect.gen(function* () {
        const result = entry("access", file)
        if (result instanceof Error) return yield* result
      }),
    chmod: (file, mode) =>
      Effect.gen(function* () {
        const result = entry("chmod", file)
        if (result instanceof Error) return yield* result
        entries.set(path.resolve(root, file), { ...result, mode })
      }),
    chown: () => Effect.fail(unsupported("chown")),
    copy: (fromPath, toPath) =>
      Effect.gen(function* () {
        const from = entry("copy", fromPath)
        if (from instanceof Error) return yield* from
        if (from.type === "directory") return yield* unsupported("copy")
        yield* writeBytes("copy", toPath, from.content, from.mode)
      }),
    copyFile: (fromPath, toPath) =>
      Effect.gen(function* () {
        const from = entry("copyFile", fromPath)
        if (from instanceof Error) return yield* from
        if (from.type !== "file") return yield* notFound("copyFile", fromPath)
        yield* writeBytes("copyFile", toPath, from.content, from.mode)
      }),
    link: () => Effect.fail(unsupported("link")),
    makeDirectory: (file, methodOptions) =>
      Effect.gen(function* () {
        const normalized = normalize("makeDirectory", file)
        if (typeof normalized !== "string") return yield* normalized
        const existing = entries.get(normalized)
        if (existing?.type === "directory") return
        if (existing) return yield* alreadyExists("makeDirectory", file)
        if (methodOptions?.recursive) {
          ensureParentDirs(normalized)
          entries.set(normalized, { type: "directory", mode: methodOptions.mode ?? 0o755, modified: touch() })
          return
        }
        const parent = entries.get(path.dirname(normalized))
        if (parent?.type !== "directory") return yield* notFound("makeDirectory", path.dirname(file))
        entries.set(normalized, { type: "directory", mode: methodOptions?.mode ?? 0o755, modified: touch() })
      }),
    makeTempDirectory: (methodOptions) =>
      Effect.gen(function* () {
        const directory = methodOptions?.directory ?? root
        const name = `${methodOptions?.prefix ?? "tmp-"}${++temp.value}`
        const file = path.join(directory, name)
        yield* base.makeDirectory(file, { recursive: true })
        return path.resolve(root, file)
      }),
    makeTempDirectoryScoped: (methodOptions) =>
      Effect.acquireRelease(
        base.makeTempDirectory(methodOptions),
        (file) => base.remove(file, { recursive: true, force: true }).pipe(Effect.ignore),
      ),
    makeTempFile: (methodOptions) =>
      Effect.gen(function* () {
        const directory = methodOptions?.directory ?? root
        const file = path.join(directory, `${methodOptions?.prefix ?? "tmp-"}${++temp.value}${methodOptions?.suffix ?? ""}`)
        yield* writeBytes("makeTempFile", file, new Uint8Array())
        return path.resolve(root, file)
      }),
    makeTempFileScoped: (methodOptions) =>
      Effect.acquireRelease(base.makeTempFile(methodOptions), (file) => base.remove(file, { force: true }).pipe(Effect.ignore)),
    open: (file) =>
      Effect.gen(function* () {
        let position = 0
        const readCurrent = () => {
          const result = entry("open", file)
          return result instanceof Error || result.type !== "file" ? undefined : result.content
        }
        const current = readCurrent()
        if (!current) return yield* notFound("open", file)
        return {
          [FileSystem.FileTypeId]: FileSystem.FileTypeId,
          fd: FileSystem.FileDescriptor(0),
          stat: base.stat(file),
          seek: (offset, from) =>
            Effect.sync(() => {
              position = from === "start" ? Number(offset) : position + Number(offset)
            }),
          sync: Effect.void,
          read: (buffer) =>
            Effect.sync(() => {
              const content = readCurrent() ?? new Uint8Array()
              const chunk = content.slice(position, position + buffer.length)
              buffer.set(chunk)
              position += chunk.length
              return FileSystem.Size(chunk.length)
            }),
          readAlloc: (size) =>
            Effect.sync(() => {
              const content = readCurrent() ?? new Uint8Array()
              const chunk = content.slice(position, position + Number(size))
              position += chunk.length
              return chunk.length === 0 ? Option.none() : Option.some(chunk)
            }),
          truncate: (size) => base.truncate(file, size),
          write: () => Effect.fail(unsupported("file.write")),
          writeAll: () => Effect.fail(unsupported("file.writeAll")),
        }
      }),
    readDirectory: (file, methodOptions) =>
      Effect.gen(function* () {
        const normalized = normalize("readDirectory", file)
        if (typeof normalized !== "string") return yield* normalized
        const current = entries.get(normalized)
        if (current?.type !== "directory") return yield* notFound("readDirectory", file)
        const items = methodOptions?.recursive ? descendants(normalized) : children(normalized)
        return items.map((item) => path.relative(normalized, item))
      }),
    readFile: (file) =>
      Effect.gen(function* () {
        const result = entry("readFile", file)
        if (result instanceof Error) return yield* result
        if (result.type !== "file") return yield* notFound("readFile", file)
        return result.content.slice()
      }),
    readLink: () => Effect.fail(unsupported("readLink")),
    realPath: (file) =>
      Effect.gen(function* () {
        const normalized = normalize("realPath", file)
        if (typeof normalized !== "string") return yield* normalized
        const current = entries.get(normalized)
        if (!current) return yield* notFound("realPath", file)
        return normalized
      }),
    remove: (file, methodOptions) =>
      Effect.gen(function* () {
        const normalized = normalize("remove", file)
        if (typeof normalized !== "string") return yield* normalized
        const current = entries.get(normalized)
        if (!current) {
          if (methodOptions?.force) return
          return yield* notFound("remove", file)
        }
        if (current.type === "directory" && descendants(normalized).length > 0 && !methodOptions?.recursive) {
          return yield* systemError({
            _tag: "BadResource",
            module: "SimulationFileSystem",
            method: "remove",
            description: "Directory is not empty",
            pathOrDescriptor: file,
          })
        }
        for (const item of descendants(normalized)) entries.delete(item)
        entries.delete(normalized)
      }),
    rename: (oldPath, newPath) =>
      Effect.gen(function* () {
        const oldNormalized = normalize("rename", oldPath)
        if (typeof oldNormalized !== "string") return yield* oldNormalized
        const newNormalized = normalize("rename", newPath)
        if (typeof newNormalized !== "string") return yield* newNormalized
        const current = entries.get(oldNormalized)
        if (!current) return yield* notFound("rename", oldPath)
        ensureParentDirs(newNormalized)
        entries.set(newNormalized, current)
        entries.delete(oldNormalized)
        for (const item of descendants(oldNormalized)) {
          const child = entries.get(item)
          if (!child) continue
          entries.set(path.join(newNormalized, path.relative(oldNormalized, item)), child)
          entries.delete(item)
        }
      }),
    stat: (file) =>
      Effect.gen(function* () {
        const result = entry("stat", file)
        if (result instanceof Error) return yield* result
        return {
          type: result.type === "directory" ? "Directory" : "File",
          mtime: Option.some(result.modified),
          atime: Option.some(result.modified),
          birthtime: Option.some(result.modified),
          dev: 0,
          ino: Option.none(),
          mode: result.mode,
          nlink: Option.none(),
          uid: Option.none(),
          gid: Option.none(),
          rdev: Option.none(),
          size: FileSystem.Size(result.type === "file" ? result.content.length : 0),
          blksize: Option.none(),
          blocks: Option.none(),
        } satisfies FileSystem.File.Info
      }),
    symlink: () => Effect.fail(unsupported("symlink")),
    truncate: (file, size = 0) =>
      Effect.gen(function* () {
        const result = entry("truncate", file)
        if (result instanceof Error) return yield* result
        if (result.type !== "file") return yield* notFound("truncate", file)
        const next = new Uint8Array(Number(size))
        next.set(result.content.slice(0, next.length))
        entries.set(path.resolve(root, file), { ...result, content: next, modified: touch() })
      }),
    utimes: (file, _atime, mtime) =>
      Effect.gen(function* () {
        const result = entry("utimes", file)
        if (result instanceof Error) return yield* result
        entries.set(path.resolve(root, file), { ...result, modified: typeof mtime === "number" ? new Date(mtime) : mtime })
      }),
    watch: () => Stream.fail(unsupported("watch")),
    writeFile: (file, content, methodOptions) => writeBytes("writeFile", file, content, methodOptions?.mode),
  })

  const glob = (pattern: string, globOptions?: Glob.Options) =>
    Effect.gen(function* () {
      const cwd = path.resolve(root, globOptions?.cwd ?? root)
      const normalized = normalize("glob", cwd)
      if (typeof normalized !== "string") return yield* normalized
      const matches = [...entries.entries()]
        .filter(([, item]) => globOptions?.include === "all" || item.type === "file")
        .map(([file]) => ({ file, relative: path.relative(normalized, file) }))
        .filter((item) => item.relative && !item.relative.startsWith("..") && Glob.match(pattern, item.relative))
        .map((item) => (globOptions?.absolute ? item.file : item.relative))
        .sort((a, b) => a.localeCompare(b))
      return matches
    })

  const service = AppFileSystem.Service.of({
    ...base,
    isDir: (file) => base.stat(file).pipe(Effect.map((info) => info.type === "Directory"), Effect.catch(() => Effect.succeed(false))),
    isFile: (file) => base.stat(file).pipe(Effect.map((info) => info.type === "File"), Effect.catch(() => Effect.succeed(false))),
    existsSafe: (file) => base.exists(file).pipe(Effect.orElseSucceed(() => false)),
    readFileStringSafe: (file) => base.readFileString(file).pipe(Effect.catch(() => Effect.succeed(undefined))),
    readJson: (file) => base.readFileString(file).pipe(Effect.map((content) => JSON.parse(content))),
    writeJson: (file, data, mode) =>
      base.writeFileString(file, JSON.stringify(data, null, 2)).pipe(Effect.andThen(mode ? base.chmod(file, mode) : Effect.void)),
    ensureDir: (file) => base.makeDirectory(file, { recursive: true }),
    writeWithDirs: (file, content, mode) =>
      Effect.gen(function* () {
        yield* base.makeDirectory(path.dirname(file), { recursive: true })
        if (typeof content === "string") yield* base.writeFileString(file, content, mode ? { mode } : undefined)
        else yield* base.writeFile(file, content, mode ? { mode } : undefined)
      }),
    readDirectoryEntries: (file) =>
      Effect.gen(function* () {
        const normalized = normalize("readDirectoryEntries", file)
        if (typeof normalized !== "string") return yield* normalized
        const current = entries.get(normalized)
        if (current?.type !== "directory") return yield* notFound("readDirectoryEntries", file)
        return children(normalized).map((child) => {
          const item = entries.get(child)
          return {
            name: path.basename(child),
            type: item?.type === "directory" ? "directory" : item?.type === "file" ? "file" : "other",
          } satisfies AppFileSystem.DirEntry
        })
      }),
    findUp: (target, start, stop) =>
      service.up({ targets: [target], start, stop }),
    up: (methodOptions) =>
      Effect.gen(function* () {
        const result: string[] = []
        let current = path.resolve(root, methodOptions.start)
        const stop = methodOptions.stop ? path.resolve(root, methodOptions.stop) : undefined
        while (true) {
          for (const target of methodOptions.targets) {
            const file = path.join(current, target)
            if (yield* base.exists(file)) result.push(file)
          }
          if (stop === current) break
          const parent = path.dirname(current)
          if (parent === current || !AppFileSystem.contains(root, parent)) break
          current = parent
        }
        return result
      }),
    globUp: (pattern, start, stop) =>
      Effect.gen(function* () {
        const result: string[] = []
        let current = path.resolve(root, start)
        const normalizedStop = stop ? path.resolve(root, stop) : undefined
        while (true) {
          result.push(...(yield* glob(pattern, { cwd: current, absolute: true, include: "file", dot: true })))
          if (normalizedStop === current) break
          const parent = path.dirname(current)
          if (parent === current || !AppFileSystem.contains(root, parent)) break
          current = parent
        }
        return result
      }),
    glob,
    globMatch: Glob.match,
  })

  return service
}

export const layer = (options: Options) => Layer.succeed(AppFileSystem.Service)(make(options))

export * as SimulationFileSystem from "./filesystem"
