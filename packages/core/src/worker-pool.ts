import { Context, Effect, Layer } from "effect"
import { Worker } from "worker_threads"
import { join } from "path"

export interface WorkerPoolConfig {
  readonly minWorkers: number
  readonly maxWorkers: number
  readonly taskTimeout: number
}

const defaultConfig: WorkerPoolConfig = {
  minWorkers: 2,
  maxWorkers: 8,
  taskTimeout: 30000,
}

export class WorkerPool extends Context.Service<WorkerPool>()("WorkerPool") {
  static create(config: Partial<WorkerPoolConfig> = {}) {
    const merged = { ...defaultConfig, ...config }
    return Layer.succeed(WorkerPool, new WorkerPoolImpl(merged))
  }
}

class WorkerPoolImpl implements WorkerPool.Service {
  private workers: Worker[] = []
  private availableWorkers: Worker[] = []
  private taskQueue: Array<{
    task: any
    resolve: (result: any) => void
    reject: (error: Error) => void
  }> = []
  private config: WorkerPoolConfig

  constructor(config: WorkerPoolConfig) {
    this.config = config
    this.initWorkers()
  }

  private initWorkers() {
    for (let i = 0; i < this.config.minWorkers; i++) {
      this.createWorker()
    }
  }

  private createWorker(): Worker {
    const worker = new Worker(
      `
      const { parentPort } = require("worker_threads");
      parentPort.on("message", async (msg) => {
        try {
          const fn = new Function("return " + msg.code)();
          const result = await fn(msg.data);
          parentPort.postMessage({ result });
        } catch (error) {
          parentPort.postMessage({ error: error.message });
        }
      });
      `,
      { eval: true }
    )

    worker.on("message", (msg) => {
      if (msg.error) {
        this.handleWorkerError(msg.error)
      } else {
        this.handleWorkerResult(msg.result)
      }
    })

    worker.on("error", (err) => {
      console.error("Worker error:", err)
      this.removeWorker(worker)
      this.createWorker()
    })

    this.workers.push(worker)
    this.availableWorkers.push(worker)
    return worker
  }

  private handleWorkerResult(result: any) {
    const available = this.availableWorkers.pop()
    if (available) {
      this.availableWorkers.push(available)
    }
    
    if (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()
      if (task) {
        this.executeTask(task.task, task.resolve, task.reject)
      }
    }
  }

  private handleWorkerError(error: any) {
    if (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()
      if (task) {
        task.reject(new Error(error))
      }
    }
  }

  private removeWorker(worker: Worker) {
    const index = this.workers.indexOf(worker)
    if (index > -1) {
      this.workers.splice(index, 1)
    }
    const availIndex = this.availableWorkers.indexOf(worker)
    if (availIndex > -1) {
      this.availableWorkers.splice(availIndex, 1)
    }
  }

  private async executeTask(
    task: { code: string; data: any },
    resolve: (result: any) => void,
    reject: (error: Error) => void
  ) {
    const worker = this.availableWorkers.pop()
    if (!worker) {
      this.taskQueue.push({ task, resolve, reject })
      return
    }

    const timeout = setTimeout(() => {
      reject(new Error("Task timeout"))
      this.removeWorker(worker)
      this.createWorker()
    }, this.config.taskTimeout)

    worker.once("message", (msg) => {
      clearTimeout(timeout)
      if (msg.error) {
        reject(new Error(msg.error))
      } else {
        resolve(msg.result)
      }
      this.availableWorkers.push(worker)
      this.processQueue()
    })

    worker.postMessage(task)
  }

  private processQueue() {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const task = this.taskQueue.shift()
      if (task) {
        this.executeTask(task.task, task.resolve, task.reject)
      }
    }
  }

  execute<T>(code: string, data: any): Effect.Effect<T> {
    return Effect.async((resolve, reject) => {
      this.executeTask({ code, data }, resolve, reject as any)
    })
  }

  stats(): Effect.Effect<{ total: number; available: number; queued: number }> {
    return Effect.sync(() => ({
      total: this.workers.length,
      available: this.availableWorkers.length,
      queued: this.taskQueue.length,
    }))
  }
}
