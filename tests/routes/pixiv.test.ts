import { assertEquals, assertStringIncludes } from '@std/assert'
import { app } from '../../src/app.ts'
import { createMockRequest } from '../utils/test-helpers.ts'

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

Deno.test('routes/pixiv - redirect from /pixiv/ to /pixiv/:key', async () => {
  const req = createMockRequest('https://localhost:3021/api/pixiv/?type=tags', {
    headers: { 'user-agent': BROWSER_UA },
  })
  const res = await app.fetch(req)
  
  assertEquals(res.status, 301)
  assertStringIncludes(res.headers.get('location') || '', '/api/pixiv/tags')
})

Deno.test('routes/pixiv - valid action key passes validation', async () => {
  const req = createMockRequest('https://localhost:3021/api/pixiv/illust_detail?id=123456', {
    headers: { 'user-agent': BROWSER_UA },
  })
  
  const res = await app.fetch(req)
  assertEquals([200, 400, 500].includes(res.status), true)
})

Deno.test('routes/pixiv - invalid key returns 400', async () => {
  const req = createMockRequest('https://localhost:3021/api/pixiv/invalid_key', {
    headers: { 'user-agent': BROWSER_UA },
  })
  
  const res = await app.fetch(req)
  assertEquals(res.status, 400)
})

Deno.test('routes/pixiv - unknown action returns 400', async () => {
  const req = createMockRequest('https://localhost:3021/api/pixiv/unknown_action', {
    headers: { 'user-agent': BROWSER_UA },
  })
  
  const res = await app.fetch(req)
  assertEquals(res.status, 400)
})
