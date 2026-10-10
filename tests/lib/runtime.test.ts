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
  resolveHost,
  runCmd,
  writeFile,
} from '#lib/runtime.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('getEnv reads value and falls back', () => {
  process.env['PXVE_TEST_GETENV'] = 'hello'
  try {
    assert.deepEqual(getEnv('PXVE_TEST_GETENV'), 'hello')
    assert.deepEqual(getEnv('PXVE_TEST_GETENV_MISSING'), undefined)
    assert.deepEqual(getEnv('PXVE_TEST_GETENV_MISSING', 'fb'), 'fb')
  } finally {
    delete process.env['PXVE_TEST_GETENV']
  }
})

test('getNumberEnv parses numbers with fallback', () => {
  process.env['PXVE_TEST_GETNUM'] = '3021'
  process.env['PXVE_TEST_GETNUM_BAD'] = 'not-a-number'
  try {
    assert.deepEqual(getNumberEnv('PXVE_TEST_GETNUM', 1111), 3021)
    assert.deepEqual(getNumberEnv('PXVE_TEST_GETNUM_MISSING', 1111), 1111)
    assert.deepEqual(getNumberEnv('PXVE_TEST_GETNUM_BAD', 1111), 1111)
  } finally {
    delete process.env['PXVE_TEST_GETNUM']
    delete process.env['PXVE_TEST_GETNUM_BAD']
  }
})

test('getCommaEnv splits trims and drops empties', () => {
  process.env['PXVE_TEST_GETCOMMA'] = ' a, b ,,c '
  try {
    assert.deepEqual(getCommaEnv('PXVE_TEST_GETCOMMA'), ['a', 'b', 'c'])
    assert.deepEqual(getCommaEnv('PXVE_TEST_GETCOMMA_MISSING'), [])
  } finally {
    delete process.env['PXVE_TEST_GETCOMMA']
  }
})

test('hasFlag returns boolean', () => {
  assert.deepEqual(hasFlag('PXVE_TEST_FLAG_THAT_DOES_NOT_EXIST'), false)
})

test('runCmd runs executable directly without shell', async () => {
  const r = await runCmd('echo', ['hello'])
  assert.deepEqual(r.success, true)
  assert.deepEqual(new TextDecoder().decode(r.stdout).trim(), 'hello')
})

test('runCmd reports non-zero exit as success false', async () => {
  const r = await runCmd('sh', ['-c', 'exit 3'])
  assert.deepEqual(r.success, false)
})

test('runCmd throws on timeout', async () => {
  let threw = false
  try {
    await runCmd('sleep', ['10'], { timeoutMs: 500 })
  } catch (e) {
    threw = true
    assert.deepEqual((e as Error).message.includes('timeout'), true)
  }
  assert.deepEqual(threw, true)
})

test('makeTempDir + writeFile + readFile + removeRecursive round-trip', async () => {
  const dir = await makeTempDir('pxve-test-')
  assert.deepEqual(dir.includes('pxve-test-'), true)
  await ensureDirRecursive(join(dir, 'sub'))
  const p = join(dir, 'sub', 'f.bin')
  await writeFile(p, new TextEncoder().encode('data123'))
  assert.deepEqual(new TextDecoder().decode(await readFile(p)), 'data123')
  await removeRecursive(dir)
  let gone = false
  try {
    await readFile(p)
  } catch {
    gone = true
  }
  assert.deepEqual(gone, true)
})

test('platformIsWindows matches current platform', () => {
  assert.deepEqual(platformIsWindows(), false)
})

test('resolveHost resolves localhost to IPs', async () => {
  const ips = await resolveHost('localhost', { timeoutMs: 5000 })
  assert.deepEqual(ips.length > 0, true)
})

test('resolveHost returns promptly for unresolvable host', async () => {
  const start = Date.now()
  const ips = await resolveHost('nonexistent.invalid', { timeoutMs: 3000 })
  assert.deepEqual(Date.now() - start < 5000, true)
  assert.deepEqual(Array.isArray(ips), true)
})
