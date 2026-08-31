const configuredQueueMax = Number(Deno.env.get('WORKER_QUEUE_MAX'))
const WORKER_QUEUE_MAX =
  Number.isFinite(configuredQueueMax) && configuredQueueMax > 0 ? Math.floor(configuredQueueMax) : 200

interface Task<T = unknown> {
  data: T
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

export class WorkerPool {
  private taskQueue: Task[] = []
  private activeWorkers = 0

  constructor(
    private readonly workerUrl: string,
    private readonly maxWorkers = 10
  ) {
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
      worker = new Worker(this.workerUrl, { type: 'module' })
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

    worker.onmessage = (e: MessageEvent) => {
      finish(() => task.resolve(e.data))
    }

    worker.onerror = (e: ErrorEvent) => {
      finish(() => {
        task.reject(new Error(e.message || 'Worker execution failed'))
      })
    }

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
    }, 30_000)
  }

  addTask(data: unknown) {
    return new Promise((resolve, reject) => {
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
