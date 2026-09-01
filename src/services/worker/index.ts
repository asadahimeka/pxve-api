import { WorkerPool } from '@lib/worker-pool.ts'

export const webpWorkerPool = new WorkerPool(import.meta.resolve('./webp-worker.ts'), 1)
export const ugoiraWorkerPool = new WorkerPool(import.meta.resolve('./ugoira-worker.ts'), 1)
