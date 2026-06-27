import { Effect, Queue, Stream } from "effect"

export interface BatchConfig {
  readonly maxSize: number
  readonly maxWaitMs: number
}

const defaultConfig: BatchConfig = {
  maxSize: 100,
  maxWaitMs: 100,
}

export class MessageBatcher<T> {
  private buffer: T[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private config: BatchConfig
  private onFlush: (items: T[]) => Effect.Effect<void>

  constructor(config: Partial<BatchConfig>, onFlush: (items: T[]) => Effect.Effect<void>) {
    this.config = { ...defaultConfig, ...config }
    this.onFlush = onFlush
  }

  add(item: T): Effect.Effect<void> {
    return Effect.sync(() => {
      this.buffer.push(item)
      if (this.buffer.length >= this.config.maxSize) {
        this.flush()
      } else if (!this.flushTimer) {
        this.flushTimer = setTimeout(() => this.flush(), this.config.maxWaitMs)
      }
    })
  }

  flush(): Effect.Effect<void> {
    return Effect.sync(() => {
      if (this.flushTimer) {
        clearTimeout(this.flushTimer)
        this.flushTimer = null
      }
      if (this.buffer.length > 0) {
        const items = [...this.buffer]
        this.buffer = []
        this.onFlush(items)
      }
    })
  }

  size(): Effect.Effect<number> {
    return Effect.sync(() => this.buffer.length)
  }

  clear(): Effect.Effect<void> {
    return Effect.sync(() => {
      this.buffer = []
      if (this.flushTimer) {
        clearTimeout(this.flushTimer)
        this.flushTimer = null
      }
    })
  }
}

export const createBatcher = <T>(
  config: Partial<BatchConfig>,
  onFlush: (items: T[]) => Effect.Effect<void>
) => new MessageBatcher<T>(config, onFlush)
