import { Effect, Queue, Schema, Stream } from "effect"
import { HttpClient, HttpClientRequest } from "effect/unstable/http"
import { EventPaths } from "../../src/server/routes/instance/httpapi/groups/event"

export const SseEvent = Schema.Struct({
  id: Schema.optional(Schema.String),
  type: Schema.String,
  properties: Schema.Record(Schema.String, Schema.Any),
})

export type SseEvent = Schema.Schema.Type<typeof SseEvent>

function decodeFrames(text: string): SseEvent[] {
  return text
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Schema.decodeUnknownSync(SseEvent)(JSON.parse(part.replace(/^data: /, ""))))
}

/**
 * Opens a scoped subscription to the instance `/event` SSE stream and returns
 * a Queue of decoded events. The underlying request and decoder fiber are
 * released when the test scope closes.
 */
export const openInstanceEventStream = (directory: string) =>
  Effect.gen(function* () {
    const response = yield* HttpClientRequest.get(EventPaths.event).pipe(
      HttpClientRequest.setHeader("x-opencode-directory", directory),
      HttpClient.execute,
    )
    const queue = yield* Queue.unbounded<SseEvent>()
    yield* response.stream.pipe(
      Stream.decodeText({ encoding: "utf-8" }),
      Stream.flatMap((text) => Stream.fromIterable(decodeFrames(text))),
      Stream.runForEach((event) => Queue.offer(queue, event)),
      Effect.forkScoped,
    )
    return queue
  })

export const readNextEvent = (queue: Queue.Queue<SseEvent>) =>
  Queue.take(queue).pipe(
    Effect.timeoutOrElse({
      duration: "3 seconds",
      orElse: () => Effect.fail(new Error("timed out reading SSE event")),
    }),
  )

export const collectUntilEvent = (queue: Queue.Queue<SseEvent>, predicate: (event: SseEvent) => boolean) =>
  Effect.gen(function* () {
    const events: SseEvent[] = []
    while (true) {
      const event = yield* readNextEvent(queue)
      events.push(event)
      if (predicate(event)) return events
    }
  }).pipe(
    Effect.timeoutOrElse({
      duration: "4 seconds",
      orElse: () => Effect.fail(new Error("collectUntilEvent deadline exceeded")),
    }),
  )
