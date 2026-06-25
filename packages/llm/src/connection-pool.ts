import { Context, Effect, Layer } from "effect"

export interface ConnectionPoolConfig {
  readonly maxConnections: number
  readonly maxIdleTime: number
  readonly keepAlive: boolean
  readonly timeout: number
}

const defaultConfig: ConnectionPoolConfig = {
  maxConnections: 10,
  maxIdleTime: 30000,
  keepAlive: true,
  timeout: 60000,
}

export class ConnectionPool extends Context.Service<ConnectionPool>()("ConnectionPool") {
  static create(config: Partial<ConnectionPoolConfig> = {}) {
    const merged = { ...defaultConfig, ...config }
    return Layer.succeed(ConnectionPool, new ConnectionPoolImpl(merged))
  }
}

class ConnectionPoolImpl implements ConnectionPool.Service {
  private connections = new Map<string, number>()
  private config: ConnectionPoolConfig

  constructor(config: ConnectionPoolConfig) {
    this.config = config
  }

  acquire(origin: string): Effect.Effect<void> {
    return Effect.sync(() => {
      const current = this.connections.get(origin) ?? 0
      if (current >= this.config.maxConnections) {
        throw new Error(`Connection pool exhausted for ${origin}`)
      }
      this.connections.set(origin, current + 1)
    })
  }

  release(origin: string): Effect.Effect<void> {
    return Effect.sync(() => {
      const current = this.connections.get(origin) ?? 0
      this.connections.set(origin, Math.max(0, current - 1))
    })
  }

  stats(): Effect.Effect<Record<string, number>> {
    return Effect.sync(() => Object.fromEntries(this.connections))
  }
}
