const WORKER_QUEUE_MAX = Number(Deno.env.get('WORKER_QUEUE_MAX') ?? 200)

export class WorkerPool {
  taskQueue: any[] = []
  maxWorkers = 10
  activeWorkers = 0
  workerUrl = ''

  constructor(workerUrl: string, maxWorkers: number) {
    this.workerUrl = workerUrl
    this.maxWorkers = maxWorkers
  }

  processTask() {
    while (this.workerUrl && this.taskQueue.length > 0 && this.activeWorkers < this.maxWorkers) {
      const task = this.taskQueue.shift()
      if (task) {
        this.activeWorkers++
        const worker = new Worker(this.workerUrl, { type: 'module' })
        worker.onmessage = e => {
          task.resolve(e.data)
          worker.terminate()
          this.activeWorkers--
          this.processTask()
        }
        worker.postMessage(task.data)
      }
    }
  }

  addTask(data: any) {
    return new Promise<any>((resolve, reject) => {
      if (this.taskQueue.length >= WORKER_QUEUE_MAX) {
        reject(new Error('Worker queue full'))
        return
      }
      this.taskQueue.push({ data, resolve })
      this.processTask()
    })
  }
}
