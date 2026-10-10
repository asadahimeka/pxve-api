import { OperationRegistry } from '../../src/lib/operation-registry.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('OperationRegistry - initializes correctly', () => {
  const registry = new OperationRegistry()
  assert.deepEqual(registry instanceof OperationRegistry, true)
  assert.deepEqual(registry.operationRegistry instanceof Map, true)
})

test('OperationRegistry - initKey creates new key', () => {
  const registry = new OperationRegistry()
  registry.initKey('test-key')
  assert.deepEqual(registry.existsKey('test-key'), true)
})

test('OperationRegistry - existsKey returns false for non-existent key', () => {
  const registry = new OperationRegistry()
  assert.deepEqual(registry.existsKey('non-existent'), false)
})

test('OperationRegistry - isExecuting marks first entry', () => {
  const registry = new OperationRegistry()
  const result = registry.isExecuting('test-key')
  assert.deepEqual(result, undefined)
  assert.deepEqual(registry.existsKey('test-key'), true)
})

test('OperationRegistry - isExecuting returns promise for subsequent calls', () => {
  const registry = new OperationRegistry()
  registry.isExecuting('test-key')
  const promise = registry.isExecuting('test-key')
  assert.ok(promise !== null && promise !== undefined)
  assert.deepEqual(promise instanceof Promise, true)
})

test('OperationRegistry - triggerAwaitingResolves resolves waiting promises', async () => {
  const registry = new OperationRegistry()
  const testValue = { data: 'test' }
  registry.isExecuting('test-key')
  const waitingPromise = registry.isExecuting('test-key') as Promise<any>
  registry.triggerAwaitingResolves('test-key', testValue)
  const result = await waitingPromise
  assert.deepEqual(result, testValue)
})

test('OperationRegistry - triggerAwaitingRejects rejects waiting promises', async () => {
  const registry = new OperationRegistry()
  const testError = new Error('Test error')
  registry.isExecuting('test-key')
  const waitingPromise = registry.isExecuting('test-key') as Promise<any>
  registry.triggerAwaitingRejects('test-key', testError)
  await waitingPromise.catch(err => {
    assert.deepEqual(err, testError)
  })
})

test('OperationRegistry - key is cleaned after trigger', () => {
  const registry = new OperationRegistry()
  registry.isExecuting('test-key')
  registry.triggerAwaitingResolves('test-key', 'value')
  assert.deepEqual(registry.existsKey('test-key'), false)
})

test('OperationRegistry - multiple waiting promises all get resolved', async () => {
  const registry = new OperationRegistry()
  const testValue = 'resolved value'
  registry.isExecuting('test-key')
  const promise1 = registry.isExecuting('test-key') as Promise<any>
  const promise2 = registry.isExecuting('test-key') as Promise<any>
  const promise3 = registry.isExecuting('test-key') as Promise<any>
  registry.triggerAwaitingResolves('test-key', testValue)
  const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3])
  assert.deepEqual(result1, testValue)
  assert.deepEqual(result2, testValue)
  assert.deepEqual(result3, testValue)
})
