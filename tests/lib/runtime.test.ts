import { assertEquals } from '@std/assert'
import { getCommaEnv, getEnv, getNumberEnv, hasFlag } from '#lib/runtime.ts'

Deno.test('getEnv reads value and falls back', () => {
  Deno.env.set('PXVE_TEST_GETENV', 'hello')
  try {
    assertEquals(getEnv('PXVE_TEST_GETENV'), 'hello')
    assertEquals(getEnv('PXVE_TEST_GETENV_MISSING'), undefined)
    assertEquals(getEnv('PXVE_TEST_GETENV_MISSING', 'fb'), 'fb')
  } finally {
    Deno.env.delete('PXVE_TEST_GETENV')
  }
})

Deno.test('getNumberEnv parses numbers with fallback', () => {
  Deno.env.set('PXVE_TEST_GETNUM', '3021')
  Deno.env.set('PXVE_TEST_GETNUM_BAD', 'not-a-number')
  try {
    assertEquals(getNumberEnv('PXVE_TEST_GETNUM', 1111), 3021)
    assertEquals(getNumberEnv('PXVE_TEST_GETNUM_MISSING', 1111), 1111)
    assertEquals(getNumberEnv('PXVE_TEST_GETNUM_BAD', 1111), 1111)
  } finally {
    Deno.env.delete('PXVE_TEST_GETNUM')
    Deno.env.delete('PXVE_TEST_GETNUM_BAD')
  }
})

Deno.test('getCommaEnv splits trims and drops empties', () => {
  Deno.env.set('PXVE_TEST_GETCOMMA', ' a, b ,,c ')
  try {
    assertEquals(getCommaEnv('PXVE_TEST_GETCOMMA'), ['a', 'b', 'c'])
    assertEquals(getCommaEnv('PXVE_TEST_GETCOMMA_MISSING'), [])
  } finally {
    Deno.env.delete('PXVE_TEST_GETCOMMA')
  }
})

Deno.test('hasFlag returns boolean', () => {
  assertEquals(hasFlag('PXVE_TEST_FLAG_THAT_DOES_NOT_EXIST'), false)
})
