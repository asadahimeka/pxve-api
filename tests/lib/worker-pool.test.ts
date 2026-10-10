import { WorkerPool } from '../../src/lib/worker-pool.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// File-based fixture (node:worker_threads has no blob-URL / self.onmessage).
// Same assertions as before: pool semantics unchanged, only transport differs.
const echoWorkerUrl = new URL('../fixtures/echo-worker.mjs', import.meta.url).href

test('WorkerPool - basic functionality', async () => {
  const pool = new WorkerPool(echoWorkerUrl, 2)

  // Test single task
  const result = await pool.addTask(5)
  assert.deepEqual(result, 10)

  // Test multiple concurrent tasks
  const results = await Promise.all([pool.addTask(3), pool.addTask(7), pool.addTask(2)])

  assert.deepEqual(results, [6, 14, 4])
})
