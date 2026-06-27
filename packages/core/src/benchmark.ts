import { Effect, pipe } from "effect"

export interface BenchmarkResult {
  name: string
  iterations: number
  totalTime: number
  avgTime: number
  minTime: number
  maxTime: number
  opsPerSecond: number
  memoryDelta: number
}

export class Benchmark {
  static async run<T>(
    name: string,
    fn: () => Promise<T>,
    iterations: number = 1000
  ): Promise<BenchmarkResult> {
    const times: number[] = []
    const memBefore = process.memoryUsage().heapUsed
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      await fn()
      const end = performance.now()
      times.push(end - start)
    }
    
    const memAfter = process.memoryUsage().heapUsed
    const totalTime = times.reduce((a, b) => a + b, 0)
    
    return {
      name,
      iterations,
      totalTime,
      avgTime: totalTime / iterations,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      opsPerSecond: (iterations / totalTime) * 1000,
      memoryDelta: (memAfter - memBefore) / 1024 / 1024,
    }
  }
  
  static async compare<T>(
    benchmarks: Array<{ name: string; fn: () => Promise<T> }>,
    iterations: number = 1000
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = []
    
    for (const benchmark of benchmarks) {
      results.push(await this.run(benchmark.name, benchmark.fn, iterations))
    }
    
    return results
  }
  
  static formatResult(result: BenchmarkResult): string {
    return `
Benchmark: ${result.name}
  Iterations: ${result.iterations}
  Total time: ${result.totalTime.toFixed(2)}ms
  Avg time: ${result.avgTime.toFixed(4)}ms
  Min time: ${result.minTime.toFixed(4)}ms
  Max time: ${result.maxTime.toFixed(4)}ms
  Ops/sec: ${result.opsPerSecond.toFixed(2)}
  Memory delta: ${result.memoryDelta.toFixed(4)}MB
`
  }
  
  static formatComparison(results: BenchmarkResult[]): string {
    const sorted = [...results].sort((a, b) => b.opsPerSecond - a.opsPerSecond)
    const fastest = sorted[0].opsPerSecond
    
    let output = "\n=== Benchmark Comparison ===\n\n"
    output += "Rank | Name                     | Ops/sec    | Avg (ms) | vs Fastest\n"
    output += "-----|--------------------------|------------|----------|----------\n"
    
    sorted.forEach((result, index) => {
      const ratio = (fastest / result.opsPerSecond).toFixed(2)
      output += `${String(index + 1).padStart(4)} | ${result.name.padEnd(24)} | ${result.opsPerSecond.toFixed(2).padStart(10)} | ${result.avgTime.toFixed(4).padStart(8)} | ${ratio}x\n`
    })
    
    return output
  }
}
