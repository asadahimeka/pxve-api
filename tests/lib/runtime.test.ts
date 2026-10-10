import { assertEquals } from '@std/assert'
import { join } from 'node:path'
import {
  ensureDirRecursive,
  getCommaEnv,
  getEnv,
  getNumberEnv,
  hasFlag,
  makeTempDir,
  platformIsWindows,
  readFile,
  removeRecursive,
  runCmd,
  writeFile,
} from '#lib/runtime.ts'

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

Deno.test('runCmd runs executable directly without shell', async () => {
  const r = await runCmd('echo', ['hello'])
  assertEquals(r.success, true)
  assertEquals(new TextDecoder().decode(r.stdout).trim(), 'hello')
})

Deno.test('runCmd reports non-zero exit as success false', async () => {
  const r = await runCmd('sh', ['-c', 'exit 3'])
  assertEquals(r.success, false)
})

Deno.test('runCmd throws on timeout', async () => {
  let threw = false
  try {
    await runCmd('sleep', ['10'], { timeoutMs: 500 })
  } catch (e) {
    threw = true
    assertEquals((e as Error).message.includes('timeout'), true)
  }
  assertEquals(threw, true)
})

Deno.test('makeTempDir + writeFile + readFile + removeRecursive round-trip', async () => {
  const dir = await makeTempDir('pxve-test-')
  assertEquals(dir.includes('pxve-test-'), true)
  await ensureDirRecursive(join(dir, 'sub'))
  const p = join(dir, 'sub', 'f.bin')
  await writeFile(p, new TextEncoder().encode('data123'))
  assertEquals(new TextDecoder().decode(await readFile(p)), 'data123')
  await removeRecursive(dir)
  let gone = false
  try {
    await readFile(p)
  } catch {
    gone = true
  }
  assertEquals(gone, true)
})

Deno.test('platformIsWindows matches current platform', () => {
  assertEquals(platformIsWindows(), false)
})
