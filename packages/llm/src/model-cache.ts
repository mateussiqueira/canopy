import { Context, Effect, Layer, Schema } from "effect"

export interface ModelCacheEntry {
  readonly id: string
  readonly provider: string
  readonly name: string
  readonly context: number
  readonly output: number
  readonly lastAccessed: number
}

export class ModelCache extends Context.Service<ModelCache>()("ModelCache") {
  static create(maxSize = 100, ttlMs = 300000) {
    return Layer.succeed(ModelCache, new ModelCacheImpl(maxSize, ttlMs))
  }
}

class ModelCacheImpl implements ModelCache.Service {
  private cache = new Map<string, ModelCacheEntry>()
  private maxSize: number
  private ttlMs: number

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize
    this.ttlMs = ttlMs
  }

  get(key: string): Effect.Effect<ModelCacheEntry | undefined> {
    return Effect.sync(() => {
      const entry = this.cache.get(key)
      if (!entry) return undefined
      if (Date.now() - entry.lastAccessed > this.ttlMs) {
        this.cache.delete(key)
        return undefined
      }
      return { ...entry, lastAccessed: Date.now() }
    })
  }

  set(key: string, entry: Omit<ModelCacheEntry, "lastAccessed">): Effect.Effect<void> {
    return Effect.sync(() => {
      if (this.cache.size >= this.maxSize) {
        const oldest = Array.from(this.cache.entries())
          .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)[0]
        if (oldest) this.cache.delete(oldest[0])
      }
      this.cache.set(key, { ...entry, lastAccessed: Date.now() })
    })
  }

  invalidate(key: string): Effect.Effect<void> {
    return Effect.sync(() => this.cache.delete(key))
  }

  clear(): Effect.Effect<void> {
    return Effect.sync(() => this.cache.clear())
  }

  stats(): Effect.Effect<{ size: number; hitRate: number }> {
    return Effect.sync(() => ({
      size: this.cache.size,
      hitRate: 0,
    }))
  }
}
