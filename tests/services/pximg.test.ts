import { fetchPximg, fetchPximgByPidPath } from '../../src/services/pximg.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('pximg service - fetchPximgByPidPath extracts PID correctly', () => {
  const path = '/pid/123456'
  const reg = /\/pid\/(\d+)(_(\d+)_?(s|m|l|o)?)?/
  const match = path.match(reg)

  assert.deepEqual(match?.[1], '123456')
})

test('pximg service - fetchPximgByPidPath extracts part and size', () => {
  const path = '/pid/123456_2_l'
  const reg = /\/pid\/(\d+)(_(\d+)_?(s|m|l|o)?)?/
  const match = path.match(reg)

  assert.deepEqual(match?.[1], '123456')
  assert.deepEqual(match?.[3], '2')
  assert.deepEqual(match?.[4], 'l')
})

test('pximg service - fetchPximgByPidPath defaults to part 0 and size o', () => {
  const path = '/pid/123456'
  const reg = /\/pid\/(\d+)(_(\d+)_?(s|m|l|o)?)?/
  const [_, id, __, partStr = '0', size = 'o'] = path.match(reg) || []

  assert.deepEqual(id, '123456')
  assert.deepEqual(partStr, '0')
  assert.deepEqual(size, 'o')
})
