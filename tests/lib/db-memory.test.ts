import { memdb } from '../../src/lib/db-memory.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('memdb - get returns default for non-existent key', () => {
  const result = memdb.get('non-existent-key')
  assert.deepEqual(result, undefined)
})

test('memdb - get returns default value for non-existent key', () => {
  const result = memdb.get('non-existent-key', 'default-value')
  assert.deepEqual(result, 'default-value')
})

test('memdb - set and get basic value', () => {
  memdb.set('test-key', 'test-value')
  const result = memdb.get('test-key')
  assert.deepEqual(result, 'test-value')
})

test('memdb - set and get object value', () => {
  const obj = { name: 'test', value: 123 }
  memdb.set('test-obj', obj)
  const result = memdb.get('test-obj')
  assert.deepEqual(result, obj)
})

test('memdb - set with expiration time', async () => {
  memdb.set('expiring-key', 'expires-soon', 1)
  const result = memdb.get('expiring-key')
  assert.deepEqual(result, 'expires-soon')
  await new Promise(resolve => setTimeout(resolve, 1100))
  const expiredResult = memdb.get('expiring-key', 'default-after-expire')
  assert.deepEqual(expiredResult, 'default-after-expire')
})

test('memdb - set with -1 expiration never expires', () => {
  memdb.set('never-expire', 'permanent', -1)
  const result = memdb.get('never-expire')
  assert.deepEqual(result, 'permanent')
})

test('memdb - delete key by setting undefined', () => {
  memdb.set('to-delete', 'value')
  memdb.set('to-delete', undefined)
  const result = memdb.get('to-delete')
  assert.deepEqual(result, undefined)
})

test('memdb - overwrites existing value', () => {
  memdb.set('overwrite-key', 'first-value')
  memdb.set('overwrite-key', 'second-value')
  const result = memdb.get('overwrite-key')
  assert.deepEqual(result, 'second-value')
})

test('memdb - handles numeric values', () => {
  memdb.set('number-key', 42)
  const result = memdb.get('number-key')
  assert.deepEqual(result, 42)
})

test('memdb - handles array values', () => {
  const arr = [1, 2, 3, 'test']
  memdb.set('array-key', arr)
  const result = memdb.get<number[]>('array-key')
  assert.deepEqual(result !== undefined, true)
  if (result) {
    assert.deepEqual(result.length, 4)
  }
})
