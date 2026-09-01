import { assertEquals, assertExists } from '@std/assert'
import { OperationRegistry } from '../../src/lib/operation-registry.ts'

Deno.test('OperationRegistry - initializes correctly', () => {
  const registry = new OperationRegistry()
  assertEquals(registry instanceof OperationRegistry, true)
  assertEquals(registry.operationRegistry instanceof Map, true)
})

Deno.test('OperationRegistry - initKey creates new key', () => {
  const registry = new OperationRegistry()
  registry.initKey('test-key')
  assertEquals(registry.existsKey('test-key'), true)
})

Deno.test('OperationRegistry - existsKey returns false for non-existent key', () => {
  const registry = new OperationRegistry()
  assertEquals(registry.existsKey('non-existent'), false)
})

Deno.test('OperationRegistry - isExecuting marks first entry', () => {
  const registry = new OperationRegistry()
  const result = registry.isExecuting('test-key')
  assertEquals(result, undefined)
  assertEquals(registry.existsKey('test-key'), true)
})

Deno.test('OperationRegistry - isExecuting returns promise for subsequent calls', () => {
  const registry = new OperationRegistry()
  registry.isExecuting('test-key')
  const promise = registry.isExecuting('test-key')
  assertExists(promise)
  assertEquals(promise instanceof Promise, true)
})

Deno.test('OperationRegistry - triggerAwaitingResolves resolves waiting promises', async () => {
  const registry = new OperationRegistry()
  const testValue = { data: 'test' }
  registry.isExecuting('test-key')
  const waitingPromise = registry.isExecuting('test-key') as Promise<any>
  registry.triggerAwaitingResolves('test-key', testValue)
  const result = await waitingPromise
  assertEquals(result, testValue)
})

Deno.test('OperationRegistry - triggerAwaitingRejects rejects waiting promises', async () => {
  const registry = new OperationRegistry()
  const testError = new Error('Test error')
  registry.isExecuting('test-key')
  const waitingPromise = registry.isExecuting('test-key') as Promise<any>
  registry.triggerAwaitingRejects('test-key', testError)
  await waitingPromise.catch((err) => {
    assertEquals(err, testError)
  })
})

Deno.test('OperationRegistry - key is cleaned after trigger', () => {
  const registry = new OperationRegistry()
  registry.isExecuting('test-key')
  registry.triggerAwaitingResolves('test-key', 'value')
  assertEquals(registry.existsKey('test-key'), false)
})

Deno.test('OperationRegistry - multiple waiting promises all get resolved', async () => {
  const registry = new OperationRegistry()
  const testValue = 'resolved value'
  registry.isExecuting('test-key')
  const promise1 = registry.isExecuting('test-key') as Promise<any>
  const promise2 = registry.isExecuting('test-key') as Promise<any>
  const promise3 = registry.isExecuting('test-key') as Promise<any>
  registry.triggerAwaitingResolves('test-key', testValue)
  const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3])
  assertEquals(result1, testValue)
  assertEquals(result2, testValue)
  assertEquals(result3, testValue)
})
