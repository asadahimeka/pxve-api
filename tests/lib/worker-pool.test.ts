import { assertEquals } from '@std/assert'
import { WorkerPool } from '../../src/lib/worker-pool.ts'

Deno.test('WorkerPool - basic functionality', async () => {
  // Test with a simple worker that doubles numbers
  const workerCode = `
    self.onmessage = (e) => {
      const data = e.data
      self.postMessage(data * 2)
    }
  `
  
  const blob = new Blob([workerCode], { type: 'application/javascript' })
  const workerUrl = URL.createObjectURL(blob)
  
  try {
    const pool = new WorkerPool(workerUrl, 2)

    // Test single task
    const result = await pool.addTask(5)
    assertEquals(result, 10)

    // Test multiple concurrent tasks
    const results = await Promise.all([
      pool.addTask(3),
      pool.addTask(7),
      pool.addTask(2),
    ])
    
    assertEquals(results, [6, 14, 4])
  } finally {
    URL.revokeObjectURL(workerUrl)
  }
})