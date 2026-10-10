import { Worker } from 'node:worker_threads'
import { pathToFileURL } from 'node:url'
import { getEnv } from './runtime.ts'

const configuredQueueMax = Number(getEnv('WORKER_QUEUE_MAX'))
const WORKER_QUEUE_MAX =
  Number.isFinite(configuredQueueMax) && configuredQueueMax > 0 ? Math.floor(configuredQueueMax) : 200
const WORKER_TIMEOUT = 60_000

function toWorkerLocation(workerUrl: string): URL | string {
  try {
    return new URL(workerUrl)
  } catch {
    return pathToFileURL(workerUrl)
  }
}

interface Task {
  data: any
  resolve: (value: any) => void
  reject: (reason?: any) => void
}

export class WorkerPool {
  private taskQueue: Task[] = []
  private activeWorkers = 0

  private readonly workerUrl: string
  private readonly maxWorkers: number

  constructor(workerUrl: string, maxWorkers = 10) {
    this.workerUrl = workerUrl
    this.maxWorkers = maxWorkers
    if (!Number.isInteger(maxWorkers) || maxWorkers <= 0) {
      throw new Error('maxWorkers must be a positive integer')
    }
  }

  private processTasks() {
    while (this.taskQueue.length > 0 && this.activeWorkers < this.maxWorkers) {
      const task = this.taskQueue.shift()!
      this.startTask(task)
    }
  }

  private startTask(task: Task) {
    this.activeWorkers++

    let worker: Worker

    try {
      worker = new Worker(toWorkerLocation(this.workerUrl))
    } catch (e) {
      this.activeWorkers--
      task.reject(e)
      this.processTasks()
      return
    }

    let settled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const finish = (fn: () => void) => {
      if (settled) return
      settled = true

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }

      worker.terminate()
      this.activeWorkers--

      fn()
      this.processTasks()
    }

    worker.on('message', (data: any) => {
      finish(() => task.resolve(data))
    })

    worker.on('error', (e: Error) => {
      finish(() => {
        task.reject(new Error(e.message || 'Worker execution failed'))
      })
    })

    worker.on('exit', (code: number) => {
      if (code !== 0) {
        finish(() => {
          task.reject(new Error(`Worker exited with code ${code}`))
        })
      }
    })

    try {
      worker.postMessage(task.data)
    } catch (e) {
      finish(() => task.reject(e))
      return
    }

    timeoutId = setTimeout(() => {
      finish(() => {
        task.reject(new Error('Worker task timeout'))
      })
    }, WORKER_TIMEOUT)
  }

  addTask(data: any) {
    return new Promise<any>((resolve, reject) => {
      if (this.taskQueue.length >= WORKER_QUEUE_MAX) {
        reject(new Error('Worker queue full'))
        return
      }

      this.taskQueue.push({
        data,
        resolve,
        reject,
      })

      this.processTasks()
    })
  }
}
