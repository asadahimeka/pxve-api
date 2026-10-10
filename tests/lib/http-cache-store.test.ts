import { assertEquals } from '@std/assert'
import { createHttpCacheStore } from '#lib/http-cache-store.ts'
import { makeTempDir, removeRecursive } from '#lib/runtime.ts'

function makeStore(opts?: { maxEntries?: number; maxSizeBytes?: number; defaultMaxAgeMs?: number }) {
  return makeTempDir('pxve-cache-test-').then(dir => ({
    dir,
    store: createHttpCacheStore({ dir, maxEntries: 100, ...opts }),
  }))
}

Deno.test('http-cache-store put then match keeps body headers status', async () => {
  const { dir, store } = await makeStore()
  try {
    await store.put(
      'http://x.test/a',
      new Response('hello-body', { status: 201, headers: { 'Content-Type': 'text/plain', 'X-Custom': 'v' } })
    )
    const hit = await store.match('http://x.test/a')
    assertEquals(hit?.status, 201)
    assertEquals(await hit?.text(), 'hello-body')
    assertEquals(hit?.headers.get('X-Custom'), 'v')
    assertEquals(await store.match('http://x.test/missing'), null)
  } finally {
    await removeRecursive(dir)
  }
})

Deno.test('http-cache-store expired entry reads as null and is cleaned', async () => {
  const { dir, store } = await makeStore()
  try {
    await store.put('http://x.test/exp', new Response('old'), 50)
    assertEquals((await store.match('http://x.test/exp')) !== null, true)
    await new Promise(r => setTimeout(r, 120))
    assertEquals(await store.match('http://x.test/exp'), null)
    const stats = await store.stats()
    assertEquals(stats.entries, 0)
  } finally {
    await removeRecursive(dir)
  }
})

Deno.test('http-cache-store evicts least-recently-used over maxEntries', async () => {
  const { dir, store } = await makeStore({ maxEntries: 2 })
  try {
    await store.put('http://x.test/a', new Response('a'))
    await store.put('http://x.test/b', new Response('b'))
    await store.match('http://x.test/a') // touch a, b is now LRU
    await store.put('http://x.test/c', new Response('c'))
    assertEquals((await store.match('http://x.test/a')) !== null, true)
    assertEquals(await store.match('http://x.test/b'), null)
    assertEquals((await store.match('http://x.test/c')) !== null, true)
  } finally {
    await removeRecursive(dir)
  }
})

Deno.test('http-cache-store survives store re-creation (restart persistence)', async () => {
  const dir = await makeTempDir('pxve-cache-test-')
  try {
    const s1 = createHttpCacheStore({ dir, maxEntries: 100 })
    await s1.put('http://x.test/keep', new Response('persisted'))
    const s2 = createHttpCacheStore({ dir, maxEntries: 100 })
    const hit = await s2.match('http://x.test/keep')
    assertEquals(await hit?.text(), 'persisted')
  } finally {
    await removeRecursive(dir)
  }
})

Deno.test('http-cache-store stats matches disk', async () => {
  const { dir, store } = await makeStore()
  try {
    await store.put('http://x.test/1', new Response('12345'))
    await store.put('http://x.test/2', new Response('1234567'))
    const stats = await store.stats()
    assertEquals(stats.entries, 2)
    assertEquals(stats.bytes >= 12, true)
    assertEquals(stats.items.length, 2)
  } finally {
    await removeRecursive(dir)
  }
})
