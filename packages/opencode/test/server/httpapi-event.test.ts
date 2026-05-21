import { NodeHttpServer, NodeServices } from "@effect/platform-node"
import { afterEach, describe, expect } from "bun:test"
import { Config, Effect, Layer, Queue } from "effect"
import { HttpClient, HttpClientRequest, HttpRouter, HttpServer } from "effect/unstable/http"
import * as Socket from "effect/unstable/socket/Socket"
import * as Log from "@opencode-ai/core/util/log"
import { Bus } from "../../src/bus"
import { Event as ServerEvent } from "../../src/server/event"
import { EventPaths } from "../../src/server/routes/instance/httpapi/groups/event"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, TestInstance } from "../fixture/fixture"
import { testEffectShared } from "../lib/effect"
import { openInstanceEventStream, readNextEvent } from "../lib/sse"

void Log.init({ print: false })

afterEach(async () => {
  await disposeAllInstances()
  await resetDatabase()
})

const servedRoutes: Layer.Layer<never, Config.ConfigError, HttpServer.HttpServer> = HttpRouter.serve(
  HttpApiApp.routes,
  { disableListenLog: true, disableLogger: true },
)

const it = testEffectShared(
  Layer.mergeAll(
    Bus.defaultLayer,
    servedRoutes.pipe(
      Layer.provide(Socket.layerWebSocketConstructorGlobal),
      Layer.provideMerge(NodeHttpServer.layerTest),
      Layer.provideMerge(NodeServices.layer),
    ),
  ),
)

describe("event HttpApi", () => {
  it.instance(
    "serves event stream with correct headers and initial server.connected",
    () =>
      Effect.gen(function* () {
        const { directory } = yield* TestInstance
        const response = yield* HttpClientRequest.get(EventPaths.event).pipe(
          HttpClientRequest.setHeader("x-opencode-directory", directory),
          HttpClient.execute,
        )

        expect(response.status).toBe(200)
        expect(response.headers["content-type"]).toContain("text/event-stream")
        expect(response.headers["cache-control"]).toBe("no-cache, no-transform")
        expect(response.headers["x-accel-buffering"]).toBe("no")
        expect(response.headers["x-content-type-options"]).toBe("nosniff")

        // Read one event to also verify the stream is wired up; the response is
        // scope-bound so the connection closes when the test ends.
        const events = yield* openInstanceEventStream(directory)
        expect(yield* readNextEvent(events)).toMatchObject({ type: "server.connected", properties: {} })
      }),
    { git: true, config: { formatter: false, lsp: false } },
  )

  it.instance(
    "keeps the event stream open after the initial event",
    () =>
      Effect.gen(function* () {
        const { directory } = yield* TestInstance
        const events = yield* openInstanceEventStream(directory)
        expect(yield* readNextEvent(events)).toMatchObject({ type: "server.connected", properties: {} })

        // If no second event arrives within 250ms, the stream is still open.
        const status = yield* Queue.take(events).pipe(
          Effect.map(() => "event" as const),
          Effect.timeoutOrElse({ duration: "250 millis", orElse: () => Effect.succeed("open" as const) }),
        )
        expect(status).toBe("open")
      }),
    { git: true, config: { formatter: false, lsp: false } },
  )

  it.instance(
    "delivers instance bus events after the initial event",
    () =>
      Effect.gen(function* () {
        const { directory } = yield* TestInstance
        const events = yield* openInstanceEventStream(directory)
        expect(yield* readNextEvent(events)).toMatchObject({ type: "server.connected", properties: {} })

        yield* Bus.Service.use((svc) => svc.publish(ServerEvent.Connected, {}))
        expect(yield* readNextEvent(events)).toMatchObject({ type: "server.connected", properties: {} })
      }),
    { git: true, config: { formatter: false, lsp: false } },
  )
})
