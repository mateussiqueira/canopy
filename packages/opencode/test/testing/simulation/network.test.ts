import { describe, expect } from "bun:test"
import { Effect, Exit, Layer, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { SimulationNetwork, type RequestInfo } from "../../../src/testing/simulation/network"
import { SimulationNetworkRoutes } from "../../../src/testing/simulation/network-routes"
import { testEffect } from "../../lib/effect"

const it = testEffect(
  SimulationNetwork.layer({
    allowLoopback: false,
    entries: [
      SimulationNetwork.json("https://models.dev/api.json", { openai: { id: "openai" } }),
      SimulationNetwork.text("https://example.com/page", "hello"),
      SimulationNetwork.json(/https:\/\/example\.com\/dynamic/, (request: RequestInfo) => ({
        method: request.method,
        query: request.url.searchParams.get("q"),
      })),
      SimulationNetwork.text(/https:\/\/example\.com\/echo-text/, (request: RequestInfo) =>
        `text:${request.method}:${request.url.searchParams.get("value")}`,
      ),
      SimulationNetwork.bytes(/https:\/\/example\.com\/echo-bytes/, (request: RequestInfo) =>
        new TextEncoder().encode(`bytes:${request.url.searchParams.get("value")}`),
      ),
      SimulationNetwork.json(
        { method: "POST", url: "https://example.com/body" },
        (request: RequestInfo) => ({
          body: request.body.type === "text" ? request.body.json : null,
        }),
      ),
      SimulationNetwork.status({ method: "GET", url: "https://example.com/method" }, 204),
      SimulationNetwork.handler({ method: "POST", url: "https://example.com/handler" }, (request: RequestInfo) =>
        new Response(JSON.stringify({ handled: request.body.type === "text" ? request.body.json : null }), {
          headers: { "content-type": "application/json" },
        }),
      ),
      SimulationNetwork.jsonSchema(
        { method: "GET", url: "https://example.com/schema" },
        Schema.Struct({ name: Schema.String, ok: Schema.Boolean }),
      ),
      ...SimulationNetworkRoutes.models("https://models.example"),
    ],
  }),
)

describe("SimulationNetwork", () => {
  it.effect("serves registered JSON responses", () =>
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient
      const response = yield* http.execute(HttpClientRequest.get("https://models.dev/api.json"))

      expect(response.status).toBe(200)
      expect(yield* response.json).toEqual({ openai: { id: "openai" } })
    }),
  )

  it.effect("serves registered text responses", () =>
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient
      const response = yield* http.execute(HttpClientRequest.get("https://example.com/page"))

      expect(response.headers["content-type"]).toContain("text/plain")
      expect(yield* response.text).toBe("hello")
    }),
  )

  it.effect("fails unknown external URLs", () =>
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient
      const exit = yield* http.execute(HttpClientRequest.get("https://api.openai.com/v1/models")).pipe(Effect.exit)

      expect(Exit.isFailure(exit)).toBe(true)
    }),
  )

  it.effect("serves dynamic request-based responses", () =>
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient
      const response = yield* http.execute(HttpClientRequest.post("https://example.com/dynamic?q=test"))

      expect(yield* response.json).toEqual({ method: "POST", query: "test" })
    }),
  )

  it.effect("serves dynamic text responses", () =>
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient
      const response = yield* http.execute(HttpClientRequest.put("https://example.com/echo-text?value=hello"))

      expect(yield* response.text).toBe("text:PUT:hello")
    }),
  )

  it.effect("serves dynamic byte responses", () =>
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient
      const response = yield* http.execute(HttpClientRequest.get("https://example.com/echo-bytes?value=hello"))

      expect(new TextDecoder().decode(yield* response.arrayBuffer)).toBe("bytes:hello")
    }),
  )

  it.effect("matches methods before serving responses", () =>
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient
      const ok = yield* http.execute(HttpClientRequest.get("https://example.com/method"))
      const miss = yield* http.execute(HttpClientRequest.post("https://example.com/method")).pipe(Effect.exit)

      expect(ok.status).toBe(204)
      expect(Exit.isFailure(miss)).toBe(true)
    }),
  )

  it.effect("passes parsed JSON request bodies to dynamic responses", () =>
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient
      const request = HttpClientRequest.post("https://example.com/body").pipe(
        HttpClientRequest.bodyJsonUnsafe({ query: "hello" }),
      )
      const response = yield* http.execute(request)

      expect(yield* response.json).toEqual({ body: { query: "hello" } })
    }),
  )

  it.effect("supports full response handlers", () =>
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient
      const request = HttpClientRequest.post("https://example.com/handler").pipe(
        HttpClientRequest.bodyJsonUnsafe({ value: 42 }),
      )
      const response = yield* http.execute(request)

      expect(yield* response.json).toEqual({ handled: { value: 42 } })
    }),
  )

  it.effect("generates JSON from registered schemas", () =>
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient
      const response = yield* http.execute(HttpClientRequest.get("https://example.com/schema"))

      expect(response.status).toBe(200)
      expect(yield* Schema.decodeUnknownEffect(Schema.Struct({ name: Schema.String, ok: Schema.Boolean }))(
        yield* response.json,
      )).toEqual(expect.objectContaining({ ok: expect.any(Boolean) }))
    }),
  )

  it.effect("registers known schema-backed route families", () =>
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient
      const response = yield* http.execute(HttpClientRequest.get("https://models.example/api.json"))

      expect(response.status).toBe(200)
      expect(typeof (yield* response.json)).toBe("object")
    }),
  )

  it.effect("can register responses after layer startup", () =>
    Effect.gen(function* () {
      const network = yield* SimulationNetwork.Service
      const http = yield* HttpClient.HttpClient

      yield* network.register(SimulationNetwork.status("https://opencode.ai/ping", 204))

      const response = yield* http.execute(HttpClientRequest.get("https://opencode.ai/ping"))
      expect(response.status).toBe(204)
    }),
  )

  it.effect("register adds static JSON responses after startup", () =>
    Effect.gen(function* () {
      const network = yield* SimulationNetwork.Service
      const http = yield* HttpClient.HttpClient

      yield* network.register(SimulationNetwork.json("https://opencode.ai/static", { ok: true }))

      const response = yield* http.execute(HttpClientRequest.get("https://opencode.ai/static"))
      expect(yield* response.json).toEqual({ ok: true })
    }),
  )

  it.effect("can register dynamic responses after layer startup", () =>
    Effect.gen(function* () {
      const network = yield* SimulationNetwork.Service
      const http = yield* HttpClient.HttpClient

      yield* network.register(
        SimulationNetwork.json("https://opencode.ai/runtime", (request: RequestInfo) => ({
          host: request.url.hostname,
          header: request.headers["x-test"],
        })),
      )

      const response = yield* http.execute(
        HttpClientRequest.get("https://opencode.ai/runtime").pipe(HttpClientRequest.setHeader("x-test", "ok")),
      )
      expect(yield* response.json).toEqual({ host: "opencode.ai", header: "ok" })
    }),
  )

  it.effect("register respects method-specific matchers", () =>
    Effect.gen(function* () {
      const network = yield* SimulationNetwork.Service
      const http = yield* HttpClient.HttpClient

      yield* network.register(SimulationNetwork.text({ method: "POST", url: "https://opencode.ai/method" }, "posted"))

      const wrongMethod = yield* http.execute(HttpClientRequest.get("https://opencode.ai/method")).pipe(Effect.exit)
      const response = yield* http.execute(HttpClientRequest.post("https://opencode.ai/method"))

      expect(Exit.isFailure(wrongMethod)).toBe(true)
      expect(yield* response.text).toBe("posted")
    }),
  )

  it.effect("register adds schema-generated responses after startup", () =>
    Effect.gen(function* () {
      const network = yield* SimulationNetwork.Service
      const http = yield* HttpClient.HttpClient
      const ResponseSchema = Schema.Struct({ id: Schema.String, enabled: Schema.Boolean })

      yield* network.register(SimulationNetwork.jsonSchema("https://opencode.ai/generated", ResponseSchema))

      const response = yield* http.execute(HttpClientRequest.get("https://opencode.ai/generated"))
      const json = yield* response.json

      const decoded = yield* Schema.decodeUnknownEffect(ResponseSchema)(json)
      expect(decoded).toEqual({ id: expect.any(String), enabled: expect.any(Boolean) })
    }),
  )
})
