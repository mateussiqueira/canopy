export * as Metrics from "./metrics"

import { Context, Effect, Layer } from "effect"
import fs from "fs"
import path from "path"
import { Global } from "./global"
import { LayerNode } from "./effect/layer-node"

// Metric types
export interface MetricPoint {
  timestamp: number
  value: number
  labels?: Record<string, string>
}

export interface MetricSummary {
  name: string
  min: number
  max: number
  avg: number
  count: number
  p50: number
  p95: number
  p99: number
}

export interface SystemMetrics {
  timestamp: number
  memory: {
    heapUsed: number
    heapTotal: number
    rss: number
    external: number
  }
  cpu: {
    user: number
    system: number
  }
  uptime: number
}

export interface ProjectMetrics {
  projectId: string
  projectName: string
  switchCount: number
  avgSwitchTime: number
  totalSwitchTime: number
  lastSwitchAt: number
  contextSize: number
}

export interface PerformanceMetrics {
  operation: string
  duration: number
  success: boolean
  error?: string
  timestamp: number
}

// Metrics service interface
export interface Interface {
  recordMetric: (name: string, value: number, labels?: Record<string, string>) => Promise<void>
  getMetricSummary: (name: string) => Promise<MetricSummary | undefined>
  getSystemMetrics: () => Promise<SystemMetrics>
  recordProjectSwitch: (projectId: string, projectName: string, duration: number) => Promise<void>
  getProjectMetrics: (projectId: string) => Promise<ProjectMetrics | undefined>
  recordPerformance: (operation: string, duration: number, success: boolean, error?: string) => Promise<void>
  getPerformanceSummary: (operation?: string) => Promise<PerformanceMetrics[]>
  getMetricsReport: () => Promise<string>
  flushMetrics: () => Promise<void>
}

export class Service extends Context.Service<Service, Interface>()("@canopy/Metrics") {}

// Metrics storage
interface MetricsStore {
  metrics: Record<string, MetricPoint[]>
  projectMetrics: Record<string, ProjectMetrics>
  performance: PerformanceMetrics[]
  systemMetrics: SystemMetrics[]
}

// Store file path
const getMetricsPath = () => path.join(Global.Path.data, "metrics.json")

// Load metrics from disk
const loadMetrics = (): MetricsStore => {
  try {
    const data = fs.readFileSync(getMetricsPath(), "utf-8")
    return JSON.parse(data)
  } catch {
    return {
      metrics: {},
      projectMetrics: {},
      performance: [],
      systemMetrics: [],
    }
  }
}

// Save metrics to disk
const saveMetrics = (store: MetricsStore): void => {
  try {
    const dir = path.dirname(getMetricsPath())
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(getMetricsPath(), JSON.stringify(store, null, 2))
  } catch (e) {
    console.error("Failed to save metrics:", e)
  }
}

// Get system metrics
const getSystemMetricsNow = (): SystemMetrics => {
  const mem = process.memoryUsage()
  const cpu = process.cpuUsage()
  return {
    timestamp: Date.now(),
    memory: {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      rss: mem.rss,
      external: mem.external,
    },
    cpu: {
      user: cpu.user,
      system: cpu.system,
    },
    uptime: process.uptime(),
  }
}

// Calculate percentiles
const calculatePercentiles = (values: number[]): { p50: number; p95: number; p99: number } => {
  const sorted = [...values].sort((a, b) => a - b)
  const len = sorted.length
  return {
    p50: sorted[Math.floor(len * 0.5)] || 0,
    p95: sorted[Math.floor(len * 0.95)] || 0,
    p99: sorted[Math.floor(len * 0.99)] || 0,
  }
}

export const layer = Layer.succeed(Service, {
  recordMetric: async (name: string, value: number, labels?: Record<string, string>) => {
    const store = loadMetrics()
    if (!store.metrics[name]) {
      store.metrics[name] = []
    }
    store.metrics[name].push({
      timestamp: Date.now(),
      value,
      labels,
    })
    if (store.metrics[name].length > 1000) {
      store.metrics[name] = store.metrics[name].slice(-1000)
    }
    saveMetrics(store)
  },

  getMetricSummary: async (name: string) => {
    const store = loadMetrics()
    const points = store.metrics[name]
    if (!points || points.length === 0) return undefined

    const values = points.map((p) => p.value)
    const sum = values.reduce((a, b) => a + b, 0)
    const percentiles = calculatePercentiles(values)

    return {
      name,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      count: values.length,
      ...percentiles,
    }
  },

  getSystemMetrics: async () => {
    return getSystemMetricsNow()
  },

  recordProjectSwitch: async (projectId: string, projectName: string, duration: number) => {
    const store = loadMetrics()
    const existing = store.projectMetrics[projectId]

    if (existing) {
      store.projectMetrics[projectId] = {
        ...existing,
        switchCount: existing.switchCount + 1,
        avgSwitchTime: (existing.totalSwitchTime + duration) / (existing.switchCount + 1),
        totalSwitchTime: existing.totalSwitchTime + duration,
        lastSwitchAt: Date.now(),
      }
    } else {
      store.projectMetrics[projectId] = {
        projectId,
        projectName,
        switchCount: 1,
        avgSwitchTime: duration,
        totalSwitchTime: duration,
        lastSwitchAt: Date.now(),
        contextSize: 0,
      }
    }

    if (!store.metrics["project_switch_duration"]) {
      store.metrics["project_switch_duration"] = []
    }
    store.metrics["project_switch_duration"].push({
      timestamp: Date.now(),
      value: duration,
      labels: { projectId, projectName },
    })

    saveMetrics(store)
  },

  getProjectMetrics: async (projectId: string) => {
    const store = loadMetrics()
    return store.projectMetrics[projectId]
  },

  recordPerformance: async (operation: string, duration: number, success: boolean, error?: string) => {
    const store = loadMetrics()
    store.performance.push({
      operation,
      duration,
      success,
      error,
      timestamp: Date.now(),
    })
    if (store.performance.length > 1000) {
      store.performance = store.performance.slice(-1000)
    }
    saveMetrics(store)
  },

  getPerformanceSummary: async (operation?: string) => {
    const store = loadMetrics()
    if (operation) {
      return store.performance.filter((p) => p.operation === operation)
    }
    return store.performance
  },

  getMetricsReport: async () => {
    const store = loadMetrics()
    const system = getSystemMetricsNow()

    const lines: string[] = []
    lines.push("═".repeat(60))
    lines.push("📊 Canopy Metrics Report")
    lines.push("═".repeat(60))
    lines.push("")

    lines.push("🖥️  System Metrics")
    lines.push("─".repeat(40))
    lines.push(`  Memory (RSS): ${(system.memory.rss / 1024 / 1024).toFixed(2)} MB`)
    lines.push(`  Heap Used: ${(system.memory.heapUsed / 1024 / 1024).toFixed(2)} MB`)
    lines.push(`  Heap Total: ${(system.memory.heapTotal / 1024 / 1024).toFixed(2)} MB`)
    lines.push(`  External: ${(system.memory.external / 1024 / 1024).toFixed(2)} MB`)
    lines.push(`  CPU User: ${(system.cpu.user / 1000).toFixed(2)} ms`)
    lines.push(`  CPU System: ${(system.cpu.system / 1000).toFixed(2)} ms`)
    lines.push(`  Uptime: ${(system.uptime / 60).toFixed(1)} minutes`)
    lines.push("")

    lines.push("📁 Project Metrics")
    lines.push("─".repeat(40))
    const projects = Object.values(store.projectMetrics)
    if (projects.length === 0) {
      lines.push("  No project metrics recorded yet")
    } else {
      for (const p of projects) {
        lines.push(`  ${p.projectName}:`)
        lines.push(`    Switches: ${p.switchCount}`)
        lines.push(`    Avg Switch Time: ${p.avgSwitchTime.toFixed(2)}ms`)
        lines.push(`    Total Switch Time: ${p.totalSwitchTime.toFixed(2)}ms`)
      }
    }
    lines.push("")

    lines.push("⚡ Performance Metrics")
    lines.push("─".repeat(40))
    if (store.performance.length === 0) {
      lines.push("  No performance metrics recorded yet")
    } else {
      const operations = [...new Set(store.performance.map((p) => p.operation))]
      for (const op of operations) {
        const opMetrics = store.performance.filter((p) => p.operation === op)
        const durations = opMetrics.map((p) => p.duration)
        const successes = opMetrics.filter((p) => p.success).length
        const percentiles = calculatePercentiles(durations)
        lines.push(`  ${op}:`)
        lines.push(`    Count: ${opMetrics.length}`)
        lines.push(`    Success Rate: ${((successes / opMetrics.length) * 100).toFixed(1)}%`)
        lines.push(`    Avg Duration: ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)}ms`)
        lines.push(`    P50: ${percentiles.p50.toFixed(2)}ms`)
        lines.push(`    P95: ${percentiles.p95.toFixed(2)}ms`)
        lines.push(`    P99: ${percentiles.p99.toFixed(2)}ms`)
      }
    }

    return lines.join("\n")
  },

  flushMetrics: async () => {
    const store = loadMetrics()
    store.systemMetrics.push(getSystemMetricsNow())
    if (store.systemMetrics.length > 100) {
      store.systemMetrics = store.systemMetrics.slice(-100)
    }
    saveMetrics(store)
  },
})

export const defaultLayer = layer
export const node = LayerNode.make(layer, [])
