import { assertEquals, assertStrictEquals } from '@std/assert'
import { memdb } from '../../src/lib/db-memory.ts'

Deno.test('memdb - get returns default for non-existent key', () => {
  const result = memdb.get('non-existent-key')
  assertEquals(result, undefined)
})

Deno.test('memdb - get returns default value for non-existent key', () => {
  const result = memdb.get('non-existent-key', 'default-value')
  assertEquals(result, 'default-value')
})

Deno.test('memdb - set and get basic value', () => {
  memdb.set('test-key', 'test-value')
  const result = memdb.get('test-key')
  assertEquals(result, 'test-value')
})

Deno.test('memdb - set and get object value', () => {
  const obj = { name: 'test', value: 123 }
  memdb.set('test-obj', obj)
  const result = memdb.get('test-obj')
  assertEquals(result, obj)
})

Deno.test('memdb - set with expiration time', async () => {
  memdb.set('expiring-key', 'expires-soon', 1)
  const result = memdb.get('expiring-key')
  assertEquals(result, 'expires-soon')
  await new Promise((resolve) => setTimeout(resolve, 1100))
  const expiredResult = memdb.get('expiring-key', 'default-after-expire')
  assertEquals(expiredResult, 'default-after-expire')
})

Deno.test('memdb - set with -1 expiration never expires', () => {
  memdb.set('never-expire', 'permanent', -1)
  const result = memdb.get('never-expire')
  assertEquals(result, 'permanent')
})

Deno.test('memdb - delete key by setting undefined', () => {
  memdb.set('to-delete', 'value')
  memdb.set('to-delete', undefined)
  const result = memdb.get('to-delete')
  assertEquals(result, undefined)
})

Deno.test('memdb - overwrites existing value', () => {
  memdb.set('overwrite-key', 'first-value')
  memdb.set('overwrite-key', 'second-value')
  const result = memdb.get('overwrite-key')
  assertEquals(result, 'second-value')
})

Deno.test('memdb - handles numeric values', () => {
  memdb.set('number-key', 42)
  const result = memdb.get('number-key')
  assertEquals(result, 42)
})

Deno.test('memdb - handles array values', () => {
  const arr = [1, 2, 3, 'test']
  memdb.set('array-key', arr)
  const result = memdb.get<number[]>('array-key')
  assertEquals(result !== undefined, true)
  if (result) {
    assertEquals(result.length, 4)
  }
})
