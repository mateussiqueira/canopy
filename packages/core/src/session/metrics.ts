import { Context, Effect, Layer } from "effect"

export interface SessionMetrics {
  readonly totalSessions: number
  readonly activeSessions: number
  readonly totalMessages: number
  readonly totalToolCalls: number
  readonly avgMessagesPerSession: number
  readonly dbSizeBytes: number
}

export class SessionStoreMetrics extends Context.Service<SessionStoreMetrics>()("SessionStoreMetrics") {
  static create() {
    return Layer.succeed(SessionStoreMetrics, new SessionStoreMetricsImpl())
  }
}

class SessionStoreMetricsImpl implements SessionStoreMetrics.Service {
  private metrics: SessionMetrics = {
    totalSessions: 0,
    activeSessions: 0,
    totalMessages: 0,
    totalToolCalls: 0,
    avgMessagesPerSession: 0,
    dbSizeBytes: 0,
  }

  update(partial: Partial<SessionMetrics>): Effect.Effect<void> {
    return Effect.sync(() => {
      this.metrics = { ...this.metrics, ...partial }
      if (this.metrics.totalSessions > 0) {
        this.metrics = {
          ...this.metrics,
          avgMessagesPerSession: this.metrics.totalMessages / this.metrics.totalSessions,
        }
      }
    })
  }

  get(): Effect.Effect<SessionMetrics> {
    return Effect.succeed(this.metrics)
  }
}
