import { assertEquals } from '@std/assert'
import { WorkerPool } from '../../src/lib/worker-pool.ts'

// File-based fixture (node:worker_threads has no blob-URL / self.onmessage).
// Same assertions as before: pool semantics unchanged, only transport differs.
const echoWorkerUrl = new URL('../fixtures/echo-worker.mjs', import.meta.url).href

Deno.test('WorkerPool - basic functionality', async () => {
  const pool = new WorkerPool(echoWorkerUrl, 2)

  // Test single task
  const result = await pool.addTask(5)
  assertEquals(result, 10)

  // Test multiple concurrent tasks
  const results = await Promise.all([pool.addTask(3), pool.addTask(7), pool.addTask(2)])

  assertEquals(results, [6, 14, 4])
})
