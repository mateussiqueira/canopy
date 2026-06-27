import { Effect, Context, Layer } from "effect"

export interface ProfilerSpan {
  name: string
  startTime: number
  endTime?: number
  metadata?: Record<string, any>
}

export class Profiler extends Context.Service<Profiler>()("Profiler") {
  static create() {
    return Layer.succeed(Profiler, new ProfilerImpl())
  }
}

class ProfilerImpl implements Profiler.Service {
  private spans: ProfilerSpan[] = []
  private activeSpans = new Map<string, ProfilerSpan>()

  start(name: string, metadata?: Record<string, any>): Effect.Effect<void> {
    return Effect.sync(() => {
      const span: ProfilerSpan = {
        name,
        startTime: performance.now(),
        metadata,
      }
      this.spans.push(span)
      this.activeSpans.set(name, span)
    })
  }

  end(name: string): Effect.Effect<number> {
    return Effect.sync(() => {
      const span = this.activeSpans.get(name)
      if (!span) return 0
      
      span.endTime = performance.now()
      this.activeSpans.delete(name)
      
      return span.endTime - span.startTime
    })
  }

  measure<T>(name: string, effect: Effect.Effect<T, unknown>): Effect.Effect<T, unknown> {
    return Effect.gen(this, function* () {
      yield* this.start(name)
      const result = yield* effect
      const duration = yield* this.end(name)
      console.log(`[Profiler] ${name}: ${duration.toFixed(2)}ms`)
      return result
    })
  }

  report(): Effect.Effect<string> {
    return Effect.sync(() => {
      const completed = this.spans.filter((s) => s.endTime !== undefined)
      const grouped = new Map<string, ProfilerSpan[]>()
      
      for (const span of completed) {
        const existing = grouped.get(span.name) || []
        existing.push(span)
        grouped.set(span.name, existing)
      }
      
      let report = "\n=== Profiler Report ===\n\n"
      report += "Name                     | Count | Total (ms) | Avg (ms) | Min (ms) | Max (ms)\n"
      report += "-------------------------|-------|------------|----------|----------|--------\n"
      
      for (const [name, spans] of grouped) {
        const durations = spans.map((s) => (s.endTime || 0) - s.startTime)
        const total = durations.reduce((a, b) => a + b, 0)
        const avg = total / durations.length
        const min = Math.min(...durations)
        const max = Math.max(...durations)
        
        report += `${name.padEnd(24)} | ${String(durations.length).padStart(5)} | ${total.toFixed(2).padStart(10)} | ${avg.toFixed(2).padStart(8)} | ${min.toFixed(2).padStart(8)} | ${max.toFixed(2).padStart(8)}\n`
      }
      
      return report
    })
  }

  reset(): Effect.Effect<void> {
    return Effect.sync(() => {
      this.spans = []
      this.activeSpans.clear()
    })
  }
}
