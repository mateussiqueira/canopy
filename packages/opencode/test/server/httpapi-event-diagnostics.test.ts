// Diagnostic suite for /event SSE delivery.
//
// Each test isolates ONE variable in the publisher chain while keeping the
// subscriber path constant (HttpClient against the in-process HttpApiApp
// routes, reading the SSE body via openInstanceEventStream). The pass/fail
// pattern across tests tells us where the bug lives:
//
//   D1 (baseline): publish via Bus.Service.use — mirror of the existing
//        httpapi-event.test.ts test 3. Confirms /event SSE delivery works for
//        a SOME publish path.
//
//   D2: publish N times in quick succession via Bus.Service.use. If the bus
//        subscription is acquired correctly there should be no message loss.
//
//   D3: publish via SyncEvent.use.run — exercises the same path the HTTP
//        handlers use (Session.updatePart → sync.run → bus.publish) without the
//        HTTP roundtrip. Tells us whether the sync path itself can deliver
//        in-process.
//
//   D4: publish via SyncEvent.use.run; subscriber is an in-process Bus
//        callback. Confirms pub/sub identity end-to-end without /event SSE.
//
//   D5: in-process Bus.Service callback subscriber AND raw /event SSE subscriber
//        receive the same publish. If both receive: no bug. If only the
//        callback receives: the /event handler has an acquisition race.
//
//   D6: same as D5 but the callback subscriber is attached AFTER /event SSE
//        subscription is established. Order-of-setup variable.
import { NodeHttpServer, NodeServices } from "@effect/platform-node"
import { afterEach, describe, expect } from "bun:test"
import { Config, Deferred, Effect, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import * as Socket from "effect/unstable/socket/Socket"
import * as Log from "@opencode-ai/core/util/log"
import { Bus } from "../../src/bus"
import { Event as ServerEvent } from "../../src/server/event"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import { MessageV2 } from "../../src/session/message-v2"
import { MessageID, PartID, SessionID } from "../../src/session/schema"
import { SyncEvent } from "../../src/sync"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, TestInstance } from "../fixture/fixture"
import { testEffectShared } from "../lib/effect"
import { collectUntilEvent, openInstanceEventStream, readNextEvent, type SseEvent } from "../lib/sse"

void Log.init({ print: false })

type BusEvent = { type: string; properties: unknown }

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
    SyncEvent.defaultLayer,
    servedRoutes.pipe(
      Layer.provide(Socket.layerWebSocketConstructorGlobal),
      Layer.provideMerge(NodeHttpServer.layerTest),
      Layer.provideMerge(NodeServices.layer),
    ),
  ),
)

const publishConnected = Bus.Service.use((svc) => svc.publish(ServerEvent.Connected, {}))

const publishPartUpdated = (partID: ReturnType<typeof PartID.ascending>) => {
  const sessionID = SessionID.make(`ses_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`)
  return SyncEvent.use.run(MessageV2.Event.PartUpdated, {
    sessionID,
    part: { id: partID, sessionID, messageID: MessageID.ascending(), type: "text", text: "diag" },
    time: Date.now(),
  })
}

const subscribeAllCallback = (handler: (event: BusEvent) => void) =>
  Effect.acquireRelease(Bus.Service.use((svc) => svc.subscribeAllCallback(handler)), (dispose) =>
    Effect.sync(dispose),
  )

const isPartUpdated = (event: { type: string }) => event.type === MessageV2.Event.PartUpdated.type

describe("/event SSE delivery diagnostics", () => {
  // Sanity: baseline same as httpapi-event.test.ts test 3 (already known to pass)
  // but explicit about timing — publish happens with NO wait after reading
  // server.connected. If this fails we have a deeper problem than just sync.
  it.instance(
    "D1: delivers a single bus event published right after server.connected",
    () =>
      Effect.gen(function* () {
        const { directory } = yield* TestInstance
        const reader = yield* openInstanceEventStream(directory)

        expect((yield* readNextEvent(reader)).type).toBe("server.connected")
        yield* publishConnected
        expect((yield* readNextEvent(reader)).type).toBe("server.connected")
      }),
    { git: true, config: { formatter: false, lsp: false } },
  )

  // If D1 passes but D2 fails, we have a queue-drain or partial-loss issue.
  it.instance(
    "D2: delivers all N bus events published in rapid succession",
    () =>
      Effect.gen(function* () {
        const { directory } = yield* TestInstance
        const reader = yield* openInstanceEventStream(directory)
        expect((yield* readNextEvent(reader)).type).toBe("server.connected")

        const N = 5
        yield* Effect.replicateEffect(publishConnected, N)

        const received = yield* Effect.replicateEffect(readNextEvent(reader), N)
        expect(received).toHaveLength(N)
        for (const event of received) expect(event.type).toBe("server.connected")
      }),
    { git: true, config: { formatter: false, lsp: false } },
  )

  // The critical test. If D1 passes but this fails, the bus-identity fix is
  // incomplete OR the sync.run publish path doesn't reach the same bus
  // /event subscribes to, even when both share the memoMap.
  it.instance(
    "D3: delivers a SyncEvent published via SyncEvent.use.run after server.connected",
    () =>
      Effect.gen(function* () {
        const { directory } = yield* TestInstance
        const reader = yield* openInstanceEventStream(directory)
        expect((yield* readNextEvent(reader)).type).toBe("server.connected")

        const partID = PartID.ascending()
        yield* publishPartUpdated(partID)

        const collected = yield* collectUntilEvent(reader, isPartUpdated)
        const updated = collected.find(isPartUpdated)
        expect(updated).toBeDefined()
        expect((updated as SseEvent).properties.part.id).toBe(partID)
      }),
    { git: true, config: { formatter: false, lsp: false } },
  )

  // If D3 passes but D5 (the SDK E2E in httpapi-sdk.test.ts) fails, then the
  // bug is specifically in the cross-request / cross-fiber HTTP path, not in
  // the publish itself. If D3 also fails, the publish chain is broken.
  //
  // D4: ensure the publish reaches an in-process Bus subscriber too. Confirms
  // pub/sub identity end-to-end without involving /event SSE.
  it.instance(
    "D4: SyncEvent.use.run publish reaches an in-process Bus.Service.use callback",
    () =>
      Effect.gen(function* () {
        const received = yield* Deferred.make<BusEvent>()
        yield* subscribeAllCallback((event) => {
          if (isPartUpdated(event)) Deferred.doneUnsafe(received, Effect.succeed(event))
        })

        const partID = PartID.ascending()
        yield* publishPartUpdated(partID)

        const event = yield* Deferred.await(received).pipe(
          Effect.timeoutOrElse({
            duration: "3 seconds",
            orElse: () => Effect.fail(new Error("D4 timed out waiting for callback")),
          }),
        )
        expect(event.type).toBe(MessageV2.Event.PartUpdated.type)
        expect((event.properties as { part: { id: string } }).part.id).toBe(partID)
      }),
    { git: true, config: { formatter: false, lsp: false } },
  )

  // D5: BOTH subscribers attached simultaneously. Trigger ONE publish via
  // SyncEvent.use.run. Both subscribers should receive it. If only one does
  // we know exactly which side of the chain is failing.
  it.instance(
    "D5: same SyncEvent.use.run publish reaches BOTH /event SSE and in-process callback",
    () =>
      Effect.gen(function* () {
        const { directory } = yield* TestInstance
        const callbackReceived = yield* Deferred.make<BusEvent>()
        yield* subscribeAllCallback((event) => {
          if (isPartUpdated(event)) Deferred.doneUnsafe(callbackReceived, Effect.succeed(event))
        })
        const reader = yield* openInstanceEventStream(directory)
        expect((yield* readNextEvent(reader)).type).toBe("server.connected")

        const partID = PartID.ascending()
        yield* publishPartUpdated(partID)

        const sseSaw = yield* collectUntilEvent(reader, isPartUpdated).pipe(
          Effect.map((events) => events.some(isPartUpdated)),
          Effect.catch(() => Effect.succeed(false)),
        )
        const callbackSaw = yield* Deferred.await(callbackReceived).pipe(
          Effect.timeoutOrElse({ duration: "1 second", orElse: () => Effect.succeed(undefined) }),
          Effect.map((event) => event !== undefined),
        )

        // Single assert with the boolean pair so the failure message tells us
        // exactly which side broke.
        expect({ sseSaw, callbackSaw }).toEqual({ sseSaw: true, callbackSaw: true })
      }),
    { git: true, config: { formatter: false, lsp: false } },
  )

  // D6: same as D5 but the callback subscriber is attached AFTER /event SSE
  // subscription is established. If D5 fails and D6 passes, the order of
  // subscriber setup is the determining factor.
  it.instance(
    "D6: /event SSE receives sync.run publish when callback is attached AFTER /event opens",
    () =>
      Effect.gen(function* () {
        const { directory } = yield* TestInstance
        const reader = yield* openInstanceEventStream(directory)
        expect((yield* readNextEvent(reader)).type).toBe("server.connected")

        const callbackReceived = yield* Deferred.make<BusEvent>()
        yield* subscribeAllCallback((event) => {
          if (isPartUpdated(event)) Deferred.doneUnsafe(callbackReceived, Effect.succeed(event))
        })

        const partID = PartID.ascending()
        yield* publishPartUpdated(partID)

        const sseSaw = yield* collectUntilEvent(reader, isPartUpdated).pipe(
          Effect.map((events) => events.some(isPartUpdated)),
          Effect.catch(() => Effect.succeed(false)),
        )
        const callbackSaw = yield* Deferred.await(callbackReceived).pipe(
          Effect.timeoutOrElse({ duration: "1 second", orElse: () => Effect.succeed(undefined) }),
          Effect.map((event) => event !== undefined),
        )
        expect({ sseSaw, callbackSaw }).toEqual({ sseSaw: true, callbackSaw: true })
      }),
    { git: true, config: { formatter: false, lsp: false } },
  )
})
