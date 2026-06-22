import { describe, expect, test } from "bun:test"
import { Effect, FileSystem, Schema, SchemaAST, SchemaGetter } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware, HttpApiSchema } from "effect/unstable/httpapi"
import { format } from "prettier"
import { compile, generate, GenerationError } from "../src"
import { it } from "./effect"
import { Api as FixtureApi } from "./fixture"

function api(endpoint: HttpApiEndpoint.Any) {
  return HttpApi.make("test").add(HttpApiGroup.make("session").add(endpoint))
}

describe("HttpApiCodegen.generate", () => {
  test("preserves public group and endpoint identifiers exactly", () => {
    const output = compile(
      HttpApi.make("test").add(
        HttpApiGroup.make("session").add(HttpApiEndpoint.get("get", "/session/:sessionID", { success: Schema.String })),
      ),
    )

    expect(output.operations[0]).toMatchObject({ group: "session", name: "get" })
  })

  test("emits one client module per HttpApi group", () => {
    const source = HttpApi.make("test")
      .add(HttpApiGroup.make("session").add(HttpApiEndpoint.get("get", "/session", { success: Schema.String })))
      .add(HttpApiGroup.make("tool").add(HttpApiEndpoint.get("list", "/tool", { success: Schema.String })))

    const output = compile(source)

    expect(output.files.map((file) => file.path)).toEqual([
      "session.ts",
      "tool.ts",
      "client-error.ts",
      "client.ts",
      "index.ts",
    ])
  })

  test("emits syntactically valid TypeScript modules", () => {
    const output = compile(
      api(
        HttpApiEndpoint.get("get", "/session/:sessionID", {
          params: { sessionID: Schema.String },
          success: Schema.Struct({ data: Schema.String }),
        }),
      ),
    )
    const transpiler = new Bun.Transpiler({ loader: "ts" })

    for (const file of output.files) expect(() => transpiler.transformSync(file.content)).not.toThrow()
  })

  it.effect("keeps the strict generated-consumer fixture current", () =>
    Effect.gen(function* () {
      const output = compile(FixtureApi)
      const actual = yield* Effect.promise(() =>
        Array.fromAsync(new Bun.Glob("*.ts").scan(new URL("generated", import.meta.url).pathname)),
      )
      expect(actual.sort((a, b) => a.localeCompare(b))).toEqual(
        output.files.map((file) => file.path).sort((a, b) => a.localeCompare(b)),
      )
      yield* Effect.forEach(output.files, (file) =>
        Effect.tryPromise(() =>
          Promise.all([
            Bun.file(new URL(`generated/${file.path}`, import.meta.url)).text(),
            format(file.content, { parser: "typescript", semi: false, printWidth: 120 }),
          ]),
        ).pipe(Effect.map(([content, expected]) => expect(content).toBe(expected))),
      )
    }),
  )

  test("flattens transport input channels into one domain input", () => {
    const output = compile(
      api(
        HttpApiEndpoint.post("prompt", "/session/:sessionID", {
          params: { sessionID: Schema.String },
          query: { resume: Schema.String },
          headers: { traceID: Schema.String },
          payload: Schema.Struct({ prompt: Schema.String }),
          success: Schema.Struct({ data: Schema.String }),
        }),
      ),
    )

    expect(output.operations[0]?.input).toEqual([
      { name: "sessionID", source: "params" },
      { name: "resume", source: "query" },
      { name: "traceID", source: "headers" },
      { name: "prompt", source: "payload" },
    ])
    expect(output.files.find((file) => file.path === "session.ts")?.content).toContain(
      'params: { "sessionID": input["sessionID"] }',
    )
  })

  test("uses no argument when an operation has no input fields", () => {
    const output = compile(api(HttpApiEndpoint.get("health", "/health", { success: Schema.String })))

    expect(output.operations[0]?.inputMode).toBe("none")
  })

  test("uses an optional object when every input field is optional", () => {
    const output = compile(
      api(
        HttpApiEndpoint.get("list", "/session", {
          query: { limit: Schema.optional(Schema.String) },
          success: Schema.Array(Schema.String),
        }),
      ),
    )

    expect(output.operations[0]?.inputMode).toBe("optional")
    expect(output.files.find((file) => file.path === "session.ts")?.content).toContain('input?.["limit"]')
  })

  test("regenerates standard HttpApi transport codecs from decoded schemas", () => {
    const output = compile(
      api(
        HttpApiEndpoint.get("list", "/session", {
          query: { archived: Schema.optional(Schema.Boolean) },
          success: Schema.String,
        }),
      ),
    )

    expect(output.files.find((file) => file.path === "session.ts")?.content).toContain("Schema.Boolean")
  })

  test("uses a required object when any input field is required", () => {
    const output = compile(
      api(
        HttpApiEndpoint.get("get", "/session/:sessionID", {
          params: { sessionID: Schema.String },
          query: { includeArchived: Schema.optional(Schema.String) },
          success: Schema.String,
        }),
      ),
    )

    expect(output.operations[0]?.inputMode).toBe("required")
  })

  test("rejects colliding input names across transport channels", () => {
    expect(() =>
      compile(
        api(
          HttpApiEndpoint.post("prompt", "/session/:id", {
            params: { id: Schema.String },
            payload: Schema.Struct({ id: Schema.String }),
            success: Schema.Void,
          }),
        ),
      ),
    ).toThrow("Input field collision: id")
  })

  test("rejects multiple payload alternatives until selection semantics are explicit", () => {
    expect(() =>
      compile(
        api(
          HttpApiEndpoint.post("prompt", "/session", {
            payload: [Schema.Struct({ text: Schema.String }), Schema.Struct({ count: Schema.Number })],
            success: Schema.String,
          }),
        ),
      ),
    ).toThrow("Multiple payload schemas: session.prompt")
  })

  test("unwraps an exact data success envelope", () => {
    const output = compile(
      api(
        HttpApiEndpoint.get("get", "/session/:sessionID", {
          params: { sessionID: Schema.String },
          success: Schema.Struct({ data: Schema.String }),
        }),
      ),
    )

    expect(output.operations[0]?.success).toBe("value")
    expect(output.files.find((file) => file.path === "session.ts")?.content).toContain(
      "Effect.map((value) => value.data)",
    )
  })

  test("maps no-content success to void", () => {
    const output = compile(
      api(HttpApiEndpoint.post("interrupt", "/session/:sessionID/interrupt", { success: HttpApiSchema.NoContent })),
    )

    expect(output.operations[0]?.success).toBe("void")
    expect(output.files.find((file) => file.path === "session.ts")?.content).toContain('"httpApiStatus": 204')
  })

  test("preserves non-default empty response statuses", () => {
    const output = compile(api(HttpApiEndpoint.post("create", "/session", { success: HttpApiSchema.Created })))

    expect(output.files.find((file) => file.path === "session.ts")?.content).toContain('"httpApiStatus": 201')
  })

  test("returns a non-envelope success unchanged", () => {
    const output = compile(api(HttpApiEndpoint.get("health", "/health", { success: Schema.String })))

    expect(output.operations[0]?.success).toBe("value")
  })

  test("rejects multiple success shapes until their public semantics are explicit", () => {
    expect(() =>
      compile(
        api(
          HttpApiEndpoint.get("get", "/session", {
            success: [Schema.String, Schema.Number],
          }),
        ),
      ),
    ).toThrow("Multiple success schemas: session.get")
  })

  test("models an SSE success as a direct stream", () => {
    const output = compile(
      api(
        HttpApiEndpoint.get("subscribe", "/event", {
          success: HttpApiSchema.StreamSse({ data: Schema.Struct({ type: Schema.String }) }),
        }),
      ),
    )

    expect(output.operations[0]?.success).toBe("stream")
  })

  test("preserves annotated stream response statuses", () => {
    const output = compile(
      api(
        HttpApiEndpoint.get("subscribe", "/event", {
          success: HttpApiSchema.StreamSse({ data: Schema.String }).pipe(HttpApiSchema.status(202)),
        }),
      ),
    )

    expect(output.files.find((file) => file.path === "session.ts")?.content).toContain(
      ".pipe(HttpApiSchema.status(202))",
    )
  })

  test("rejects schemas whose semantics cannot be emitted exactly", () => {
    const OpaqueUrl = Schema.declare((input): input is URL => input instanceof URL)

    expect(() => compile(api(HttpApiEndpoint.get("get", "/url", { success: OpaqueUrl })))).toThrow(
      "Unportable schema: session.get.success",
    )
  })

  test("rejects custom transformations hidden beneath standard HttpApi codecs", () => {
    const QueryBoolean = Schema.Literals(["yes", "no"]).pipe(
      Schema.decodeTo(Schema.Boolean, {
        decode: SchemaGetter.transform((value) => value === "yes"),
        encode: SchemaGetter.transform((value) => (value ? "yes" : "no")),
      }),
    )

    expect(() =>
      compile(
        api(
          HttpApiEndpoint.get("get", "/session", {
            query: { archived: QueryBoolean },
            success: Schema.String,
          }),
        ),
      ),
    ).toThrow("Unportable schema: session.get.query")
  })

  test("rejects custom validation checks without portable metadata", () => {
    const Positive = Schema.Number.check(Schema.makeFilter((value) => (value > 0 ? undefined : "positive")))

    expect(() => compile(api(HttpApiEndpoint.get("get", "/session", { success: Positive })))).toThrow(
      "Unportable schema: session.get.success",
    )
  })

  test("rejects spoofed and aborted validation checks", () => {
    const Spoofed = Schema.Number.check(
      Schema.makeFilter(() => "always fails", { meta: { _tag: "isFinite" }, arbitrary: {} }),
    )
    const Aborted = Schema.Number.check(Schema.isFinite().abort())

    expect(() => compile(api(HttpApiEndpoint.get("spoofed", "/session", { success: Spoofed })))).toThrow(
      "Unportable schema: session.spoofed.success",
    )
    expect(() => compile(api(HttpApiEndpoint.get("aborted", "/session", { success: Aborted })))).toThrow(
      "Unportable schema: session.aborted.success",
    )
  })

  test("rejects altered wire-side schemas even when the codec transformation is canonical", () => {
    const JsonNumber = Schema.toCodecJson(Schema.Number)
    const link = JsonNumber.ast.encoding?.[0]
    if (link === undefined) throw new Error("Expected JSON number encoding")
    // This helper is present at runtime but omitted from the public declaration surface.
    const replaceEncoding: unknown = Reflect.get(SchemaAST, "replaceEncoding")
    if (typeof replaceEncoding !== "function") throw new Error("Expected SchemaAST.replaceEncoding")
    const ast: unknown = replaceEncoding(JsonNumber.ast, [
      new SchemaAST.Link(Schema.String.check(Schema.isMinLength(2)).ast, link.transformation),
    ])
    if (!SchemaAST.isAST(ast)) throw new Error("Expected altered schema AST")
    const Altered = Schema.make(ast)

    expect(() => compile(api(HttpApiEndpoint.get("get", "/session", { success: Altered })))).toThrow(
      "Unportable schema: session.get.success",
    )
  })

  test("rejects lexical generation and annotation values", () => {
    const Generated = Schema.declare((input): input is string => typeof input === "string").annotate({
      generation: { runtime: "LocalOnly", Type: "string" },
    })
    const Annotated = Schema.declare((input): input is string => typeof input === "string").annotate({
      custom: () => "local",
    })

    expect(() => compile(api(HttpApiEndpoint.get("generated", "/session", { success: Generated })))).toThrow(
      "Unportable schema: session.generated.success",
    )
    expect(() => compile(api(HttpApiEndpoint.get("annotated", "/session", { success: Annotated })))).toThrow(
      "Unportable schema: session.annotated.success",
    )
  })

  test("preserves errors from server-only middleware", () => {
    class Unauthorized extends Schema.TaggedErrorClass<Unauthorized>()("Unauthorized", {}) {}
    class Authorization extends HttpApiMiddleware.Service<Authorization>()("Authorization", {
      error: Unauthorized,
    }) {}

    const output = compile(
      api(HttpApiEndpoint.get("get", "/session", { success: Schema.String }).middleware(Authorization)),
    )

    expect(output.operations[0]).toBeDefined()
    expect(output.files.find((file) => file.path === "session.ts")?.content).toContain(
      'extends Schema.TaggedErrorClass<Endpoint0Error0Class>("Unauthorized")',
    )
  })

  test("preserves tagged error response statuses", () => {
    class Missing extends Schema.TaggedErrorClass<Missing>()("Missing", {}) {}
    const output = compile(
      api(
        HttpApiEndpoint.get("get", "/session", {
          success: Schema.String,
          error: Missing.pipe(HttpApiSchema.status(404)),
        }),
      ),
    )

    expect(output.files.find((file) => file.path === "session.ts")?.content).toContain(
      'Endpoint0Error0Class.annotate({ "httpApiStatus": 404 })',
    )
  })

  test("supports every HttpApi method through the generic constructor", () => {
    const output = compile(api(HttpApiEndpoint.make("TRACE")("trace", "/trace", { success: Schema.String })))

    expect(output.files.find((file) => file.path === "session.ts")?.content).toContain('HttpApiEndpoint.make("TRACE")')
  })

  test("uses safe unique module paths without changing public group identifiers", () => {
    const output = compile(
      HttpApi.make("test")
        .add(HttpApiGroup.make("../session").add(HttpApiEndpoint.get("get", "/session", { success: Schema.String })))
        .add(HttpApiGroup.make("GROUP-0").add(HttpApiEndpoint.get("list", "/session", { success: Schema.String }))),
    )

    expect(output.files.slice(0, 2).map((file) => file.path)).toEqual(["group-0.ts", "GROUP-0-1.ts"])
    expect(output.files[0]?.content).toContain('HttpApiGroup.make("../session"')
  })

  test("reserves support module names case-insensitively", () => {
    const output = compile(
      HttpApi.make("test")
        .add(HttpApiGroup.make("client").add(HttpApiEndpoint.get("get", "/client", { success: Schema.String })))
        .add(HttpApiGroup.make("INDEX").add(HttpApiEndpoint.get("get", "/index", { success: Schema.String }))),
    )

    expect(output.files.slice(0, 2).map((file) => file.path)).toEqual(["client-0.ts", "INDEX-1.ts"])
  })

  test("keeps searching when a reserved-name fallback is also occupied", () => {
    const output = compile(
      HttpApi.make("test")
        .add(HttpApiGroup.make("client-1").add(HttpApiEndpoint.get("first", "/first", { success: Schema.String })))
        .add(HttpApiGroup.make("client").add(HttpApiEndpoint.get("second", "/second", { success: Schema.String }))),
    )

    expect(output.files.slice(0, 2).map((file) => file.path)).toEqual(["client-1.ts", "client-1-1.ts"])
  })

  test("rejects collisions in the flattened client namespace", () => {
    expect(() =>
      compile(
        HttpApi.make("test")
          .add(HttpApiGroup.make("status").add(HttpApiEndpoint.get("get", "/nested", { success: Schema.String })))
          .add(
            HttpApiGroup.make("system", { topLevel: true }).add(
              HttpApiEndpoint.get("status", "/status", { success: Schema.String }),
            ),
          ),
      ),
    ).toThrow("Client name collision: status")
  })

  test("emits a usable raw type for top-level groups", () => {
    const output = compile(
      HttpApi.make("test").add(
        HttpApiGroup.make("health", { topLevel: true }).add(
          HttpApiEndpoint.get("check", "/health", { success: Schema.String }),
        ),
      ),
    )

    expect(output.files[0]?.content).toContain("type RawGroup = HttpApiClient.Client<typeof Group0")
  })

  it.effect("reports compiler failures in the generate Effect", () =>
    Effect.gen(function* () {
      const error = yield* generate(
        api(
          HttpApiEndpoint.get("get", "/url", {
            success: Schema.declare((input): input is URL => input instanceof URL),
          }),
        ),
        {
          directory: "/generated",
        },
      ).pipe(Effect.flip)

      expect(error).toBeInstanceOf(GenerationError)
      if (error instanceof GenerationError) expect(error.reason).toBe("Unportable schema: session.get.success")
    }).pipe(Effect.provideService(FileSystem.FileSystem, FileSystem.makeNoop({}))),
  )

  test("rejects required client middleware without an adapter", () => {
    class SignedRequest extends HttpApiMiddleware.Service<SignedRequest>()("SignedRequest", {
      requiredForClient: true,
    }) {}

    expect(() =>
      compile(api(HttpApiEndpoint.get("get", "/session", { success: Schema.String }).middleware(SignedRequest))),
    ).toThrow("Client middleware requires adapter: SignedRequest")
  })

  test("maps transport and decode failures to one stable client error", () => {
    const output = compile(
      api(
        HttpApiEndpoint.get("get", "/session", {
          success: Schema.String,
        }),
      ),
    )

    expect(output.operations[0]?.errors).toContain("ClientError")
    expect(output.operations[0]?.errors).not.toContain("HttpClientError")
    expect(output.operations[0]?.errors).not.toContain("SchemaError")
    expect(output.files.find((file) => file.path === "session.ts")?.content).toContain(
      "new ClientError({ cause: error })",
    )
  })
})
