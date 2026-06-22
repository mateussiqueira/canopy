import { isAbsolute, join } from "node:path"
import { Effect, FileSystem, PlatformError, Schema, SchemaAST, SchemaRepresentation } from "effect"
import type { HttpRouter } from "effect/unstable/http"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"
import { format } from "prettier"

export type InputField = {
  readonly name: string
  readonly source: "params" | "query" | "headers" | "payload"
}

export type Operation = {
  readonly group: string
  readonly name: string
  readonly input: ReadonlyArray<InputField>
  readonly inputMode: "none" | "optional" | "required"
  readonly success: "value" | "void" | "stream"
  readonly errors: ReadonlyArray<string>
}

export type Output = {
  readonly operations: ReadonlyArray<Operation>
  readonly files: ReadonlyArray<{
    readonly path: string
    readonly content: string
  }>
}

export class GenerationError extends Schema.TaggedErrorClass<GenerationError>()("GenerationError", {
  reason: Schema.String,
}) {
  override get message() {
    return this.reason
  }
}

type Endpoint = {
  readonly group: string
  readonly topLevel: boolean
  readonly endpoint: HttpApiEndpoint.AnyWithProps
  readonly params: Schema.Top | undefined
  readonly query: Schema.Top | undefined
  readonly headers: Schema.Top | undefined
  readonly payloads: ReadonlyArray<Schema.Top>
  readonly operation: Operation
  readonly input: ReadonlyArray<InputField & { readonly optional: boolean }>
  readonly unwrapData: boolean
  readonly errors: ReadonlyArray<Schema.Top>
  readonly successes: ReadonlyArray<Schema.Top>
}

type Group = {
  readonly identifier: string
  readonly module: string
  readonly endpoints: ReadonlyArray<Endpoint>
}

type Slot = {
  readonly name: string
  readonly schema: Schema.Top
}

const resolveHttpApiStatus = SchemaAST.resolveAt<number>("httpApiStatus")
const resolveHttpApiEncoding = SchemaAST.resolveAt<unknown>("~httpApiEncoding")
const Manifest = Schema.fromJsonString(Schema.Array(Schema.String))
const manifestName = ".httpapi-codegen.json"

export function compile<Id extends string, Groups extends HttpApiGroup.Any>(api: HttpApi.HttpApi<Id, Groups>): Output {
  const endpoints: Array<Endpoint> = []
  const portable = new Map<SchemaAST.AST, boolean>()

  HttpApi.reflect(api, {
    onGroup() {},
    onEndpoint({ endpoint, errors, group, middleware }) {
      const name = `${group.identifier}.${endpoint.name}`
      const required = Array.from(middleware).find((item) => item.requiredForClient)
      if (required !== undefined) {
        throw new GenerationError({ reason: `Client middleware requires adapter: ${required.key}` })
      }

      const successSchemas = Array.from(endpoint.success)
      if (successSchemas.length === 0) successSchemas.push(HttpApiSchema.NoContent)
      if (successSchemas.length > 1) throw new GenerationError({ reason: `Multiple success schemas: ${name}` })

      const params = normalizeTransport(endpoint.params, "params", endpoint, name)
      const query = normalizeTransport(endpoint.query, "query", endpoint, name)
      const headers = normalizeTransport(endpoint.headers, "headers", endpoint, name)
      const sourcePayloads = Array.from(endpoint.payload.values()).flatMap(({ schemas }) => schemas)
      if (sourcePayloads.length > 1) {
        throw new GenerationError({ reason: `Multiple payload schemas: ${name}` })
      }
      const payloads = sourcePayloads.map((schema) => normalizeTransport(schema, "payload", endpoint, name)!)
      const success = normalizeTransport(successSchemas[0], "success", endpoint, name)!
      const errorSchemas = Array.from(errors.values()).flatMap((schemas) =>
        schemas.map((schema) => normalizeTransport(schema, "error", endpoint, name)!),
      )
      const inputs = [
        ...inputFields(params, "params", name),
        ...inputFields(query, "query", name),
        ...inputFields(headers, "headers", name),
        ...payloads.flatMap((schema) => inputFields(schema, "payload", name)),
      ]
      const names = new Set<string>()
      for (const field of inputs) {
        if (names.has(field.name)) throw new GenerationError({ reason: `Input field collision: ${field.name}` })
        names.add(field.name)
      }

      const schemaPaths: Array<readonly [string, Schema.Top]> = [
        ...(params === undefined ? [] : [[`${name}.params`, params] as const]),
        ...(query === undefined ? [] : [[`${name}.query`, query] as const]),
        ...(headers === undefined ? [] : [[`${name}.headers`, headers] as const]),
        ...payloads.map((schema) => [`${name}.payload`, schema] as const),
        ...responseSchemas(success, `${name}.success`),
        ...errorSchemas.map((schema) => [`${name}.error`, schema] as const),
      ]
      for (const [path, schema] of schemaPaths) assertPortable(schema, path, portable)

      endpoints.push({
        group: group.identifier,
        topLevel: group.topLevel,
        endpoint,
        params,
        query,
        headers,
        payloads,
        input: inputs,
        unwrapData: isDataEnvelope(success),
        successes: [success],
        errors: errorSchemas,
        operation: {
          group: group.identifier,
          name: endpoint.name,
          input: inputs.map(({ name, source }) => ({ name, source })),
          inputMode: inputs.length === 0 ? "none" : inputs.every((field) => field.optional) ? "optional" : "required",
          success: isStreamSchema(success) ? "stream" : HttpApiSchema.isNoContent(success.ast) ? "void" : "value",
          errors: [
            ...new Set([
              ...errorSchemas.flatMap((schema) => {
                const identifier = SchemaAST.resolveIdentifier(schema.ast)
                return identifier === undefined ? [] : [identifier]
              }),
              "ClientError",
            ]),
          ],
        },
      })
    },
  })

  const modules = new Set(["client", "client-error", "index"])
  const groups = Array.from(
    Map.groupBy(endpoints, (endpoint) => endpoint.group),
    ([identifier, endpoints], index) => {
      const base = /^[A-Za-z0-9_-]+$/.test(identifier) ? identifier : `group-${index}`
      const module = uniqueModule(base, index, modules)
      modules.add(module.toLowerCase())
      return { identifier, module, endpoints }
    },
  )
  const publicNames = new Set<string>()
  for (const group of groups) {
    const names = group.endpoints[0]?.topLevel ? group.endpoints.map((item) => item.endpoint.name) : [group.identifier]
    for (const name of names) {
      if (publicNames.has(name)) throw new GenerationError({ reason: `Client name collision: ${name}` })
      publicNames.add(name)
    }
  }
  return {
    operations: endpoints.map((endpoint) => endpoint.operation),
    files: [
      ...groups.map((group, index) => ({
        path: `${group.module}.ts`,
        content: renderGroup(group, index),
      })),
      {
        path: "client-error.ts",
        content:
          'import { Schema } from "effect"\n\nexport class ClientError extends Schema.TaggedErrorClass<ClientError>()("ClientError", {\n  cause: Schema.Defect(),\n}) {}\n',
      },
      { path: "client.ts", content: renderClient(groups) },
      { path: "index.ts", content: 'export { ClientError } from "./client-error"\nexport { make } from "./client"\n' },
    ],
  }
}

function uniqueModule(base: string, index: number, modules: ReadonlySet<string>) {
  if (!modules.has(base.toLowerCase())) return base
  const seed = `${base}-${index}`
  let suffix = 0
  while (modules.has(`${seed}${suffix === 0 ? "" : `-${suffix}`}`.toLowerCase())) suffix++
  return `${seed}${suffix === 0 ? "" : `-${suffix}`}`
}

function normalizeTransport(
  schema: Schema.Top | undefined,
  source: InputField["source"] | "success" | "error",
  endpoint: HttpApiEndpoint.AnyWithProps,
  operation: string,
) {
  if (schema === undefined || isStreamSchema(schema)) return schema
  if (!metadataPortable(schema.ast, new Set())) {
    throw new GenerationError({ reason: `Unportable schema: ${operation}.${source}` })
  }
  const decoded = Schema.toType(schema)
  if (!isPathInput(endpoint.path)) {
    throw new GenerationError({ reason: `Invalid endpoint path: ${operation}` })
  }
  const rebuilt = HttpApiEndpoint.make(endpoint.method)(endpoint.name, endpoint.path, {
    ...(source === "params" ? { params: decoded } : undefined),
    ...(source === "query" ? { query: decoded } : undefined),
    ...(source === "headers" ? { headers: decoded } : undefined),
    ...(source === "payload" ? { payload: decoded } : undefined),
    ...(source === "success" ? { success: decoded } : { success: Schema.String }),
    ...(source === "error" ? { error: decoded } : undefined),
  })
  const normalized =
    source === "params"
      ? rebuilt.params
      : source === "query"
        ? rebuilt.query
        : source === "headers"
          ? rebuilt.headers
          : source === "payload"
            ? Array.from(rebuilt.payload.values())[0]?.schemas[0]
            : source === "success"
              ? Array.from(rebuilt.success)[0]
              : Array.from(rebuilt.error)[0]
  if (normalized === undefined || !sameEncoding(schema.ast, normalized.ast)) {
    throw new GenerationError({ reason: `Unportable schema: ${operation}.${source}` })
  }
  return decoded
}

function isPathInput(path: string): path is HttpRouter.PathInput {
  return path === "*" || path.startsWith("/")
}

function sameEncoding(left: SchemaAST.AST, right: SchemaAST.AST): boolean {
  if (left._tag !== right._tag || left.encoding?.length !== right.encoding?.length) return false
  if (
    left.encoding?.some((link, index) => {
      const other = right.encoding?.[index]
      return other === undefined || link.transformation !== other.transformation || !sameEncoding(link.to, other.to)
    })
  )
    return false
  if (!sameChecks(left.checks, right.checks) || !sameContext(left.context, right.context)) return false
  if (SchemaAST.isSuspend(left) && SchemaAST.isSuspend(right)) return sameEncoding(left.thunk(), right.thunk())
  if (SchemaAST.isUnion(left) && SchemaAST.isUnion(right)) {
    return (
      left.types.length === right.types.length &&
      left.types.every((ast, index) => sameEncoding(ast, right.types[index]))
    )
  }
  if (SchemaAST.isArrays(left) && SchemaAST.isArrays(right)) {
    return (
      left.elements.length === right.elements.length &&
      left.rest.length === right.rest.length &&
      left.elements.every((ast, index) => sameEncoding(ast, right.elements[index])) &&
      left.rest.every((ast, index) => sameEncoding(ast, right.rest[index]))
    )
  }
  if (SchemaAST.isObjects(left) && SchemaAST.isObjects(right)) {
    return (
      left.propertySignatures.length === right.propertySignatures.length &&
      left.indexSignatures.length === right.indexSignatures.length &&
      left.propertySignatures.every((field, index) => sameEncoding(field.type, right.propertySignatures[index].type)) &&
      left.indexSignatures.every(
        (field, index) =>
          sameEncoding(field.parameter, right.indexSignatures[index].parameter) &&
          sameEncoding(field.type, right.indexSignatures[index].type),
      )
    )
  }
  return true
}

function sameChecks(left: SchemaAST.Checks | undefined, right: SchemaAST.Checks | undefined): boolean {
  if (left?.length !== right?.length) return false
  if (left === undefined || right === undefined) return true
  return left.every((check, index) => {
    const other = right[index]
    if (other === undefined || check._tag !== other._tag) return false
    if (check._tag === "Filter" && other._tag === "Filter") {
      return check.run === other.run && check.aborted === other.aborted
    }
    return check._tag === "FilterGroup" && other._tag === "FilterGroup" && sameChecks(check.checks, other.checks)
  })
}

function sameContext(left: SchemaAST.Context | undefined, right: SchemaAST.Context | undefined) {
  return left?.isOptional === right?.isOptional && left?.isMutable === right?.isMutable
}

export function write(
  output: Output,
  directory: string,
): Effect.Effect<void, GenerationError | PlatformError.PlatformError, FileSystem.FileSystem> {
  return Effect.gen(function* () {
    const paths = new Set<string>()
    for (const file of output.files) {
      if (!isSafeOutputPath(file.path)) yield* new GenerationError({ reason: `Unsafe output path: ${file.path}` })
      const path = file.path.toLowerCase()
      if (paths.has(path)) yield* new GenerationError({ reason: `Duplicate output path: ${file.path}` })
      paths.add(path)
    }
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(directory, { recursive: true })
    const manifest = join(directory, manifestName)
    const previous = (yield* fs.exists(manifest))
      ? yield* fs.readFileString(manifest).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(Manifest)),
          Effect.mapError(() => new GenerationError({ reason: `Invalid generated file manifest: ${manifest}` })),
        )
      : []
    if (previous.some((path) => !isSafeOutputPath(path))) {
      yield* new GenerationError({ reason: `Invalid generated file manifest: ${manifest}` })
    }
    yield* Effect.forEach(
      previous.filter((path) => !output.files.some((file) => file.path === path)),
      (path) => fs.remove(join(directory, path), { force: true }),
      { concurrency: 8, discard: true },
    )
    yield* Effect.forEach(
      output.files,
      (file) =>
        fs.exists(join(directory, file.path)).pipe(
          Effect.flatMap((exists) => (exists ? fs.stat(join(directory, file.path)) : Effect.succeed(undefined))),
          Effect.flatMap((info) =>
            info?.type === "SymbolicLink"
              ? new GenerationError({ reason: `Unsafe output path: ${file.path}` })
              : Effect.void,
          ),
        ),
      { concurrency: 8, discard: true },
    )
    yield* Effect.forEach(
      output.files,
      (file) =>
        Effect.tryPromise({
          try: () => format(file.content, { parser: "typescript", semi: false, printWidth: 120 }),
          catch: (error) => new GenerationError({ reason: `Failed to format ${file.path}: ${String(error)}` }),
        }).pipe(Effect.flatMap((content) => fs.writeFileString(join(directory, file.path), content))),
      { concurrency: 8, discard: true },
    )
    yield* fs.writeFileString(manifest, JSON.stringify(output.files.map((file) => file.path).sort(), null, 2) + "\n")
  })
}

function isSafeOutputPath(path: string) {
  return path !== manifestName && !isAbsolute(path) && path !== "." && path !== ".." && !/[\\/]/.test(path)
}

export function generate<Id extends string, Groups extends HttpApiGroup.Any>(
  api: HttpApi.HttpApi<Id, Groups>,
  options: { readonly directory: string },
): Effect.Effect<void, GenerationError | PlatformError.PlatformError, FileSystem.FileSystem> {
  return Effect.try({
    try: () => compile(api),
    catch: (error) => (error instanceof GenerationError ? error : new GenerationError({ reason: String(error) })),
  }).pipe(Effect.flatMap((output) => write(output, options.directory)))
}

function inputFields(schema: Schema.Top | undefined, source: InputField["source"], operation: string) {
  if (schema === undefined) return []
  const ast = Schema.toType(schema).ast
  if (!SchemaAST.isObjects(ast) || ast.indexSignatures.length > 0) {
    throw new GenerationError({ reason: `Input schema must be a struct: ${operation}.${source}` })
  }
  return ast.propertySignatures.map((field) => {
    if (typeof field.name !== "string") {
      throw new GenerationError({ reason: `Input field must have a string name: ${operation}.${source}` })
    }
    return {
      name: field.name,
      source,
      optional: SchemaAST.isOptional(field.type),
    }
  })
}

function responseSchemas(schema: Schema.Top, path: string): Array<readonly [string, Schema.Top]> {
  if (HttpApiSchema.isNoContent(schema.ast)) return []
  if (!isStreamSchema(schema)) return [[path, schema]]
  if (schema._tag === "StreamUint8Array") return []
  const value = schema.sseMode === "data" ? streamDataSchema(schema) : schema.events
  const rebuilt =
    schema.sseMode === "data"
      ? HttpApiSchema.StreamSse({ data: value, error: schema.error, contentType: schema.contentType })
      : HttpApiSchema.StreamSse({
          events: schema.events,
          error: schema.error,
          contentType: schema.contentType,
        })
  if (!sameEncoding(schema.events.ast, rebuilt.events.ast)) {
    throw new GenerationError({ reason: `Unportable schema: ${path}.${schema.sseMode}` })
  }
  return [
    [`${path}.${schema.sseMode}`, value],
    [`${path}.error`, schema.error],
  ]
}

function assertPortable(schema: Schema.Top, path: string, portable: Map<SchemaAST.AST, boolean>) {
  const visiting = new Set<SchemaAST.AST>()
  const taggedError = taggedErrorFields(schema)
  const visit = (ast: SchemaAST.AST): boolean => {
    const cached = portable.get(ast)
    if (cached !== undefined) return cached
    if (visiting.has(ast)) return true
    visiting.add(ast)
    const result = visitCurrent(ast)
    visiting.delete(ast)
    portable.set(ast, result)
    return result
  }
  const visitCurrent = (ast: SchemaAST.AST): boolean => {
    if (!annotationsPortable(ast.annotations)) return false
    if (!checksPortable(ast.checks) || ("encodingChecks" in ast && !checksPortable(ast.encodingChecks))) return false
    if (SchemaAST.isDeclaration(ast)) {
      return generationPortable(ast.annotations?.generation) && ast.typeParameters.every(visit)
    }
    if (ast.encoding !== undefined && ast.annotations?.generation === undefined) return false
    if (SchemaAST.isSuspend(ast)) return visit(ast.thunk())
    if (SchemaAST.isUnion(ast)) return ast.types.every(visit)
    if (SchemaAST.isArrays(ast)) {
      return ast.elements.every(visit) && ast.rest.every(visit)
    }
    if (SchemaAST.isObjects(ast)) {
      return (
        ast.propertySignatures.every((field) => visit(field.type)) &&
        ast.indexSignatures.every((index) => visit(index.parameter) && visit(index.type))
      )
    }
    if (SchemaAST.isTemplateLiteral(ast)) return ast.parts.every(visit)
    return true
  }
  if (taggedError !== undefined && SchemaAST.isDeclaration(schema.ast)) {
    if (
      schema.ast.checks !== undefined ||
      ("encodingChecks" in schema.ast && !checksPortable(schema.ast.encodingChecks)) ||
      schema.ast.typeParameters.some((ast) => ast.checks !== undefined) ||
      !schema.ast.typeParameters.every(visit)
    ) {
      throw new GenerationError({ reason: `Unportable schema: ${path}` })
    }
    return
  }
  if (!visit(schema.ast)) throw new GenerationError({ reason: `Unportable schema: ${path}` })
}

function checksPortable(checks: SchemaAST.Checks | undefined): boolean {
  if (checks === undefined) return true
  return checks.every((check) =>
    check._tag === "Filter"
      ? !check.aborted &&
        check.annotations?.meta !== undefined &&
        typeof check.annotations.arbitrary === "object" &&
        check.annotations.arbitrary !== null &&
        "constraint" in check.annotations.arbitrary
      : checksPortable(check.checks),
  )
}

function metadataPortable(ast: SchemaAST.AST, seen: Set<SchemaAST.AST>): boolean {
  if (seen.has(ast)) return true
  seen.add(ast)
  if (!annotationsPortable(ast.annotations) || !checksPortable(ast.checks)) return false
  if ("encodingChecks" in ast && !checksPortable(ast.encodingChecks)) return false
  if (ast.encoding?.some((link) => !metadataPortable(link.to, seen))) return false
  if (SchemaAST.isDeclaration(ast)) return ast.typeParameters.every((item) => metadataPortable(item, seen))
  if (SchemaAST.isSuspend(ast)) return metadataPortable(ast.thunk(), seen)
  if (SchemaAST.isUnion(ast)) return ast.types.every((item) => metadataPortable(item, seen))
  if (SchemaAST.isArrays(ast)) {
    return (
      ast.elements.every((item) => metadataPortable(item, seen)) &&
      ast.rest.every((item) => metadataPortable(item, seen))
    )
  }
  if (SchemaAST.isObjects(ast)) {
    return (
      ast.propertySignatures.every((field) => metadataPortable(field.type, seen)) &&
      ast.indexSignatures.every(
        (field) => metadataPortable(field.parameter, seen) && metadataPortable(field.type, seen),
      )
    )
  }
  return true
}

function generationPortable(generation: unknown): boolean {
  if (typeof generation !== "object" || generation === null) return false
  const value = generation as {
    readonly runtime?: unknown
    readonly Type?: unknown
    readonly importDeclaration?: unknown
  }
  if (typeof value.runtime !== "string" || typeof value.Type !== "string") return false
  if (value.importDeclaration !== undefined) {
    if (
      typeof value.importDeclaration !== "string" ||
      !/from ["']effect(?:\/[^"']+)?["']$/.test(value.importDeclaration)
    ) {
      return false
    }
  }
  const namespace =
    typeof value.importDeclaration === "string"
      ? /import(?: type)? \* as ([A-Za-z_$][\w$]*)/.exec(value.importDeclaration)?.[1]
      : undefined
  return value.runtime.startsWith("Schema.") || (namespace !== undefined && value.runtime.startsWith(`${namespace}.`))
}

function annotationsPortable(annotations: Schema.Annotations.Annotations | undefined) {
  if (annotations === undefined) return true
  return Object.entries(annotations).every(([key, value]) => {
    if (
      ["toCodec", "toCodecJson", "toArbitrary", "toFormatter", "toEquivalence", "~effect/Schema/Class"].includes(key)
    ) {
      return true
    }
    if (key === "generation") return generationPortable(value)
    return serializable(value)
  })
}

function serializable(value: unknown): boolean {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true
  if (Array.isArray(value)) return value.every(serializable)
  if (typeof value !== "object") return false
  return Object.values(value).every(serializable)
}

function taggedErrorFields(schema: Schema.Top) {
  if (!SchemaAST.isDeclaration(schema.ast) || schema.ast.annotations?.["~effect/Schema/Class"] === undefined) {
    return undefined
  }
  const fields = schema.ast.typeParameters[0]
  if (!SchemaAST.isObjects(fields) || fields.indexSignatures.length > 0) return undefined
  const tag = fields.propertySignatures.find((field) => field.name === "_tag")?.type
  if (tag === undefined || !SchemaAST.isLiteral(tag) || typeof tag.literal !== "string") return undefined
  return {
    tag: tag.literal,
    identifier: SchemaAST.resolveIdentifier(schema.ast) ?? tag.literal,
    fields: fields.propertySignatures.flatMap((field) =>
      field.name === "_tag" || typeof field.name !== "string" ? [] : [[field.name, Schema.make(field.type)] as const],
    ),
  }
}

function isDataEnvelope(schema: Schema.Top) {
  if (isStreamSchema(schema) || HttpApiSchema.isNoContent(schema.ast)) return false
  const ast = Schema.toType(schema).ast
  return (
    SchemaAST.isObjects(ast) &&
    ast.indexSignatures.length === 0 &&
    ast.propertySignatures.length === 1 &&
    ast.propertySignatures[0]?.name === "data"
  )
}

function isStreamSchema(schema: Schema.Top): schema is HttpApiSchema.StreamSchema {
  return "_tag" in schema && (schema._tag === "StreamSse" || schema._tag === "StreamUint8Array")
}

function streamDataSchema(schema: Extract<HttpApiSchema.StreamSchema, { readonly _tag: "StreamSse" }>) {
  const ast = Schema.toType(schema.events).ast
  if (!SchemaAST.isObjects(ast)) throw new GenerationError({ reason: "Invalid SSE data schema" })
  const data = ast.propertySignatures.find((field) => field.name === "data")?.type
  if (data === undefined) throw new GenerationError({ reason: "Invalid SSE data schema" })
  return Schema.make(data)
}

function renderGroup(group: Group, groupIndex: number) {
  const slots: Array<Slot> = []
  const adapters: Array<string> = []
  const endpointSources = group.endpoints.map(
    (
      {
        endpoint,
        errors,
        headers: endpointHeaders,
        params: endpointParams,
        payloads: endpointPayloads,
        query: endpointQuery,
        successes,
      },
      endpointIndex,
    ) => {
      const prefix = `Endpoint${endpointIndex}`
      const params = addSlot(endpointParams, `${prefix}Params`)
      const query = addSlot(endpointQuery, `${prefix}Query`)
      const headers = addSlot(endpointHeaders, `${prefix}Headers`)
      const payloads = endpointPayloads.map((schema, index) => addSlot(schema, `${prefix}Payload${index}`)!)
      const success = renderSuccess(successes[0], `${prefix}Success`)
      const errorSlots = errors.map((schema, index) => addSlot(schema, `${prefix}Error${index}`)!)
      const options = [
        params === undefined ? undefined : `params: ${params.name}`,
        query === undefined ? undefined : `query: ${query.name}`,
        headers === undefined ? undefined : `headers: ${headers.name}`,
        payloads.length === 0
          ? undefined
          : `payload: ${payloads.length === 1 ? payloads[0].name : `[${payloads.map((slot) => slot.name).join(", ")}]`}`,
        `success: ${success.source}`,
        errorSlots.length === 0
          ? undefined
          : `error: ${errorSlots.length === 1 ? errorSlots[0].name : `[${errorSlots.map((slot) => slot.name).join(", ")}]`}`,
      ].filter((option): option is string => option !== undefined)
      const operation = group.endpoints[endpointIndex]
      if (operation === undefined) {
        throw new GenerationError({ reason: `Missing operation: ${group.identifier}.${endpoint.name}` })
      }
      const schemaBySource = { params, query, headers, payload: payloads[0] }
      const inputType = operation.input
        .map((field) => {
          const slot = schemaBySource[field.source]
          if (slot === undefined) {
            throw new GenerationError({ reason: `Missing input schema: ${group.identifier}.${endpoint.name}` })
          }
          return `readonly ${JSON.stringify(field.name)}${field.optional ? "?" : ""}: (typeof ${slot.name}.Type)[${JSON.stringify(field.name)}]`
        })
        .join("; ")
      const argument =
        operation.operation.inputMode === "none"
          ? ""
          : `input${operation.operation.inputMode === "optional" ? "?" : ""}: ${prefix}Input`
      const request = (["params", "query", "headers", "payload"] as const)
        .flatMap((source) => {
          const slot = schemaBySource[source]
          if (slot === undefined) return []
          const fields = operation.input
            .filter((field) => field.source === source)
            .map(
              (field) =>
                `${JSON.stringify(field.name)}: input${operation.operation.inputMode === "optional" ? "?." : ""}[${JSON.stringify(field.name)}]`,
            )
          return [`${source}: { ${fields.join(", ")} }`]
        })
        .join(", ")
      const declared = [...errorSlots, ...(success.streamError === undefined ? [] : [success.streamError])]
      const declaredSchema =
        declared.length === 0 ? "Schema.Never" : `Schema.Union([${declared.map((slot) => slot.name).join(", ")}])`
      const rawCall = `raw[${JSON.stringify(endpoint.name)}]({ ${request} })`
      const mapped = `${rawCall}.pipe(Effect.mapError(map${prefix}Error)${operation.unwrapData ? ", Effect.map((value) => value.data)" : ""})`
      const inputDeclaration =
        operation.operation.inputMode === "none" ? "" : `type ${prefix}Input = { ${inputType} }\n`
      adapters.push(
        `${inputDeclaration}const ${prefix}DeclaredError = ${declaredSchema}\nconst map${prefix}Error = (error: unknown) => HttpClientError.isHttpClientError(error) || Schema.isSchemaError(error) || Sse.Retry.is(error) ? new ClientError({ cause: error }) : Schema.is(${prefix}DeclaredError)(error) ? error : new ClientError({ cause: error })\nconst ${prefix} = (raw: RawGroup) => (${argument}) => ${operation.operation.success === "stream" ? `Stream.unwrap(${rawCall}.pipe(Effect.mapError(map${prefix}Error), Effect.map((stream) => stream.pipe(Stream.mapError(map${prefix}Error)))))` : mapped}`,
      )
      return `HttpApiEndpoint.make(${JSON.stringify(endpoint.method)})(${JSON.stringify(endpoint.name)}, ${JSON.stringify(endpoint.path)}, { ${options.join(", ")} })`
    },
  )

  function addSlot(schema: Schema.Top | undefined, name: string) {
    if (schema === undefined) return undefined
    const slot = { name, schema }
    slots.push(slot)
    return slot
  }

  function renderSuccess(schema: Schema.Top, name: string) {
    if (!isStreamSchema(schema)) return { source: addSlot(schema, name)!.name }
    const status = resolveHttpApiStatus(schema.ast) ?? 200
    const annotate = status === 200 ? "" : `.pipe(HttpApiSchema.status(${status}))`
    if (schema._tag === "StreamUint8Array") {
      return {
        source: `HttpApiSchema.StreamUint8Array({ contentType: ${JSON.stringify(schema.contentType)} })${annotate}`,
      }
    }
    const value = addSlot(
      schema.sseMode === "data" ? streamDataSchema(schema) : schema.events,
      `${name}${schema.sseMode === "data" ? "Data" : "Events"}`,
    )!
    const error = addSlot(schema.error, `${name}Error`)!
    return {
      source: `HttpApiSchema.StreamSse({ ${schema.sseMode}: ${value.name}, error: ${error.name}, contentType: ${JSON.stringify(schema.contentType)} })${annotate}`,
      streamError: error,
    }
  }

  const declarations = renderSchemas(slots)
  const groupSource = `HttpApiGroup.make(${JSON.stringify(group.identifier)}, { topLevel: ${group.endpoints[0]?.topLevel ?? false} })${endpointSources.map((endpoint) => `.add(${endpoint})`).join("")}`
  const usesHttpApiSchema = endpointSources.some((source) => source.includes("HttpApiSchema."))
  const methods = group.endpoints
    .map((item, index) => `${JSON.stringify(item.endpoint.name)}: Endpoint${index}(raw)`)
    .join(", ")
  const rawGroup = group.endpoints[0]?.topLevel
    ? `HttpApiClient.Client<typeof Group${groupIndex}>`
    : `HttpApiClient.Client.Group<typeof Group${groupIndex}, ${JSON.stringify(group.identifier)}, never, never>`
  const usesStream = group.endpoints.some((item) => item.operation.success === "stream")
  return `// Generated by @opencode-ai/httpapi-codegen. Do not edit.\nimport { Effect, Schema${usesStream ? ", Stream" : ""} } from "effect"\nimport { Sse } from "effect/unstable/encoding"\nimport { HttpClientError } from "effect/unstable/http"\nimport { HttpApiClient, HttpApiEndpoint, HttpApiGroup${usesHttpApiSchema ? ", HttpApiSchema" : ""} } from "effect/unstable/httpapi"\nimport { ClientError } from "./client-error"\n\n${declarations}\n\nexport const Group${groupIndex} = ${groupSource}\n\ntype RawGroup = ${rawGroup}\n\n${adapters.join("\n\n")}\n\nexport const adaptGroup${groupIndex} = (raw: RawGroup) => ({ ${methods} })\n`
}

function renderSchemas(slots: ReadonlyArray<Slot>) {
  if (slots.length === 0) return ""
  const classes = new Map(
    slots.flatMap((slot, index) => {
      const tagged = taggedErrorFields(slot.schema)
      return tagged === undefined ? [] : [[index, tagged] as const]
    }),
  )
  const expanded = [
    ...slots.map((slot, index) => (classes.has(index) ? { name: slot.name, schema: Schema.Never } : slot)),
    ...Array.from(classes.values()).flatMap((tagged, classIndex) =>
      tagged.fields.map(([name, schema]) => ({ name: `Class${classIndex}${name}`, schema })),
    ),
  ]
  const [first, ...rest] = expanded
  const document = SchemaRepresentation.toCodeDocument(
    SchemaRepresentation.fromASTs([first.schema.ast, ...rest.map((slot) => slot.schema.ast)]),
  )
  const artifacts = document.artifacts.flatMap((artifact) => {
    if (artifact._tag === "Import") return [artifact.importDeclaration]
    if (artifact._tag === "Enum") return [artifact.generation.runtime]
    return [`const ${artifact.identifier} = ${artifact.generation.runtime}`]
  })
  const references = [
    ...document.references.nonRecursives.map(({ $ref, code }) => `const ${$ref} = ${code.runtime}`),
    ...Object.entries(document.references.recursives).map(
      ([$ref, code]) => `type ${$ref} = ${code.Type}\nconst ${$ref}: Schema.Codec<${$ref}> = ${code.runtime}`,
    ),
  ]
  let fieldIndex = slots.length
  const declarations = slots.map((slot, index) => {
    const tagged = classes.get(index)
    if (tagged === undefined) return `const ${slot.name} = ${document.codes[index].runtime}`
    const fields = tagged.fields
      .map(([name]) => `${JSON.stringify(name)}: ${document.codes[fieldIndex++].runtime}`)
      .join(", ")
    const annotations = Object.entries({
      httpApiStatus: resolveHttpApiStatus(slot.schema.ast),
      "~httpApiEncoding": resolveHttpApiEncoding(slot.schema.ast),
    }).filter((entry) => entry[1] !== undefined)
    const annotate =
      annotations.length === 0
        ? ""
        : `.annotate({ ${annotations.map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(", ")} })`
    return `class ${slot.name}Class extends Schema.TaggedErrorClass<${slot.name}Class>(${JSON.stringify(tagged.identifier)})(${JSON.stringify(tagged.tag)}, { ${fields} }) {}\nconst ${slot.name} = ${slot.name}Class${annotate}`
  })
  return [...artifacts, ...references, ...declarations].join("\n\n")
}

function renderClient(groups: ReadonlyArray<Group>) {
  const imports = groups
    .map((group, index) => `import { adaptGroup${index}, Group${index} } from ${JSON.stringify(`./${group.module}`)}`)
    .join("\n")
  const api = `HttpApi.make("generated")${groups.map((_, index) => `.add(Group${index})`).join("")}`
  const fields = groups.flatMap((group, index) => {
    if (!group.endpoints[0]?.topLevel) {
      return [`${JSON.stringify(group.identifier)}: adaptGroup${index}(raw[${JSON.stringify(group.identifier)}])`]
    }
    const raw = `{ ${group.endpoints.map((item) => `${JSON.stringify(item.endpoint.name)}: raw[${JSON.stringify(item.endpoint.name)}]`).join(", ")} }`
    return [`...adaptGroup${index}(${raw})`]
  })
  return `// Generated by @opencode-ai/httpapi-codegen. Do not edit.\nimport { Effect } from "effect"\nimport { HttpApi, HttpApiClient } from "effect/unstable/httpapi"\n${imports}\n\nconst Api = ${api}\n\nexport const make = (options?: { readonly baseUrl?: URL | string }) =>\n  HttpApiClient.make(Api, options).pipe(Effect.map((raw) => ({ ${fields.join(", ")} })))\n`
}
