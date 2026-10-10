import { WorkerPool } from '#lib/worker-pool.ts'

export const webpWorkerPool = new WorkerPool(new URL('./webp-worker.ts', import.meta.url).href, 1)
export const ugoiraWorkerPool = new WorkerPool(import.meta.resolve('./ugoira-worker.ts'), 1)
