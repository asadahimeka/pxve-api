import { assertEquals, assertRejects } from '@std/assert'
import { fetchPximg, fetchPximgByPidPath } from '../../src/services/pximg.ts'

Deno.test('pximg service - fetchPximgByPidPath extracts PID correctly', () => {
  const path = '/pid/123456'
  const reg = /\/pid\/(\d+)(_(\d+)_?(s|m|l|o)?)?/
  const match = path.match(reg)

  assertEquals(match?.[1], '123456')
})

Deno.test('pximg service - fetchPximgByPidPath extracts part and size', () => {
  const path = '/pid/123456_2_l'
  const reg = /\/pid\/(\d+)(_(\d+)_?(s|m|l|o)?)?/
  const match = path.match(reg)

  assertEquals(match?.[1], '123456')
  assertEquals(match?.[3], '2')
  assertEquals(match?.[4], 'l')
})

Deno.test('pximg service - fetchPximgByPidPath defaults to part 0 and size o', () => {
  const path = '/pid/123456'
  const reg = /\/pid\/(\d+)(_(\d+)_?(s|m|l|o)?)?/
  const [_, id, __, partStr = '0', size = 'o'] = path.match(reg) || []

  assertEquals(id, '123456')
  assertEquals(partStr, '0')
  assertEquals(size, 'o')
})
