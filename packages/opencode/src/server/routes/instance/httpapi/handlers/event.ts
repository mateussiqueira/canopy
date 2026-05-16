import { Bus } from "@/bus"
import * as Log from "@opencode-ai/core/util/log"
import { Effect, Queue } from "effect"
import * as Stream from "effect/Stream"
import { HttpServerResponse } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import * as Sse from "effect/unstable/encoding/Sse"
import { EventApi } from "../groups/event"

const log = Log.create({ service: "server" })
type InstanceEvent = { id: string; type: string; properties: unknown }

function eventData(data: unknown): Sse.Event {
  return {
    _tag: "Event",
    event: "message",
    id: undefined,
    data: JSON.stringify(data),
  }
}

function eventResponse(bus: Bus.Interface) {
  return Effect.gen(function* () {
    const context = yield* Effect.context()

    const events = connectedEvents(bus).pipe(
      Stream.provideContext(context),
      Stream.takeUntil((event) => event.type === Bus.InstanceDisposed.type),
    )
    const heartbeat = Stream.tick("10 seconds").pipe(
      Stream.drop(1),
      Stream.map(() => ({ id: Bus.createID(), type: "server.heartbeat", properties: {} })),
    )

    log.info("event connected")
    return HttpServerResponse.stream(
      events.pipe(
        Stream.merge(heartbeat, { haltStrategy: "left" }),
        Stream.map(eventData),
        Stream.pipeThroughChannel(Sse.encode()),
        Stream.encodeText,
        Stream.ensuring(Effect.sync(() => log.info("event disconnected"))),
      ),
      {
        contentType: "text/event-stream",
        headers: {
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
          "X-Content-Type-Options": "nosniff",
        },
      },
    )
  })
}

function connectedEvents(bus: Bus.Interface) {
  return Stream.callback<InstanceEvent>((queue) =>
    Effect.acquireRelease(
      bus.subscribeAllCallback((event) => Queue.offerUnsafe(queue, event)).pipe(
        Effect.tap(() => Effect.sync(() => Queue.offerUnsafe(queue, connectedEvent()))),
      ),
      (unsubscribe) => Effect.sync(unsubscribe),
    ),
  )
}

function connectedEvent(): InstanceEvent {
  return { id: Bus.createID(), type: "server.connected", properties: {} }
}

export const eventHandlers = HttpApiBuilder.group(EventApi, "event", (handlers) =>
  Effect.gen(function* () {
    const bus = yield* Bus.Service
    return handlers.handleRaw(
      "subscribe",
      Effect.fn("EventHttpApi.subscribe")(function* () {
        return yield* eventResponse(bus)
      }),
    )
  }),
)
