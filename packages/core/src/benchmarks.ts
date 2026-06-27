import { Effect } from "effect"
import { Benchmark } from "./benchmark"

export const runSessionBenchmarks = async () => {
  console.log("Running Canopy Session Benchmarks...\n")
  
  const results = await Benchmark.compare([
    {
      name: "Effect.gen (simple)",
      fn: async () => {
        await Effect.runPromise(
          Effect.gen(function* () {
            const a = yield* Effect.succeed(1)
            const b = yield* Effect.succeed(2)
            return a + b
          })
        )
      },
    },
    {
      name: "Effect.gen (with error)",
      fn: async () => {
        await Effect.runPromise(
          Effect.gen(function* () {
            const a = yield* Effect.succeed(1)
            const b = yield* Effect.fail("error").pipe(Effect.catchAll(() => Effect.succeed(0)))
            return a + b
          })
        )
      },
    },
    {
      name: "Effect.map",
      fn: async () => {
        await Effect.runPromise(
          Effect.succeed(1).pipe(Effect.map((a) => a + 1))
        )
      },
    },
    {
      name: "Effect.flatMap",
      fn: async () => {
        await Effect.runPromise(
          Effect.succeed(1).pipe(Effect.flatMap((a) => Effect.succeed(a + 1)))
        )
      },
    },
    {
      name: "Effect.all (parallel)",
      fn: async () => {
        await Effect.runPromise(
          Effect.all([
            Effect.succeed(1),
            Effect.succeed(2),
            Effect.succeed(3),
          ], { concurrency: "unbounded" })
        )
      },
    },
    {
      name: "Effect.all (sequential)",
      fn: async () => {
        await Effect.runPromise(
          Effect.all([
            Effect.succeed(1),
            Effect.succeed(2),
            Effect.succeed(3),
          ], { concurrency: 1 })
        )
      },
    },
    {
      name: "Schema validation",
      fn: async () => {
        const { Schema } = await import("effect")
        const schema = Schema.Struct({
          id: Schema.String,
          name: Schema.String,
          value: Schema.Number,
        })
        Schema.decode(schema)({ id: "1", name: "test", value: 42 })
      },
    },
    {
      name: "Promise (baseline)",
      fn: async () => {
        await Promise.resolve(1 + 2)
      },
    },
    {
      name: "Async/Await (baseline)",
      fn: async () => {
        const fn = async () => 1 + 2
        await fn()
      },
    },
  ], 10000)
  
  console.log(Benchmark.formatComparison(results))
  
  return results
}

export const runStreamingBenchmarks = async () => {
  console.log("Running Streaming Benchmarks...\n")
  
  const results = await Benchmark.compare([
    {
      name: "Array.reduce",
      fn: async () => {
        Array.from({ length: 100 }, (_, i) => i).reduce((a, b) => a + b, 0)
      },
    },
    {
      name: "for loop",
      fn: async () => {
        let sum = 0
        for (let i = 0; i < 100; i++) {
          sum += i
        }
        return sum
      },
    },
    {
      name: "Map + reduce",
      fn: async () => {
        Array.from({ length: 100 }, (_, i) => i)
          .map((x) => x * 2)
          .reduce((a, b) => a + b, 0)
      },
    },
    {
      name: "Generator function",
      fn: async () => {
        function* gen() {
          for (let i = 0; i < 100; i++) {
            yield i
          }
        }
        let sum = 0
        for (const val of gen()) {
          sum += val
        }
        return sum
      },
    },
  ], 10000)
  
  console.log(Benchmark.formatComparison(results))
  
  return results
}

if (require.main === module) {
  runSessionBenchmarks()
    .then(() => runStreamingBenchmarks())
    .then(() => console.log("Benchmarks complete!"))
}
