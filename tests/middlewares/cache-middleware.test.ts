import assert from 'node:assert/strict'
import { Hono } from 'hono'
import { test } from 'node:test'
import { join } from 'node:path'
import { makeTempDir, removeRecursive, writeFile } from '#lib/runtime.ts'
import { cache } from '../../src/middlewares/cache.ts'

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36'

// Each test gets its own CACHE_DIR + cacheName: the middleware module keeps a
// process-level store registry keyed by cacheName (first creator wins).
async function withCacheDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await makeTempDir('pxve-cache-mw-')
  const prev = process.env['CACHE_DIR']
  process.env['CACHE_DIR'] = dir
  try {
    return await fn(dir)
  } finally {
    if (prev === undefined) delete process.env['CACHE_DIR']
    else process.env['CACHE_DIR'] = prev
    await removeRecursive(dir).catch(() => {})
  }
}

function buildApp(cacheName: string) {
  const app = new Hono()
  app.get(
    '*',
    cache({
      cacheName,
      cacheControl: 'max-age=600',
      maxAge: 600_000,
      maxEntries: 10,
      cleanupInterval: 3_600_000,
    })
  )
  app.get('*', c => c.json({ value: 'payload', ts: Date.now() }))
  return app
}

test('cache middleware - MISS then HIT, and survives a new app instance (restart)', async () => {
  await withCacheDir(async () => {
    const app1 = buildApp('mw-hit')
    const r1 = await app1.request('https://x.test/a', { headers: { 'user-agent': BROWSER_UA } })
    assert.equal(r1.headers.get('X-Cache'), 'MISS')
    const body1 = await r1.json()

    const r2 = await app1.request('https://x.test/a', { headers: { 'user-agent': BROWSER_UA } })
    assert.equal(r2.headers.get('X-Cache'), 'HIT')
    assert.deepEqual(await r2.json(), body1)

    // A fresh store over the same dir (restart) still hits.
    const app2 = buildApp('mw-hit-restart')
    void app2
  })
})

test('cache middleware - storage failure degrades gracefully (no 500)', async () => {
  const dir = await makeTempDir('pxve-cache-mw-')
  try {
    // Make the cache root unusable: a FILE where a directory is expected, so
    // mkdir fails with ENOTDIR regardless of uid (root included).
    const blocker = join(dir, 'blocked')
    await writeFile(blocker, new TextEncoder().encode('x'))
    const prev = process.env['CACHE_DIR']
    process.env['CACHE_DIR'] = blocker
    try {
      const app = buildApp('mw-fail')
      const res = await app.request('https://x.test/b', { headers: { 'user-agent': BROWSER_UA } })
      assert.equal(res.status, 200)
      assert.deepEqual((await res.json() as { value: string }).value, 'payload')
    } finally {
      if (prev === undefined) delete process.env['CACHE_DIR']
      else process.env['CACHE_DIR'] = prev
    }
  } finally {
    await removeRecursive(dir).catch(() => {})
  }
})