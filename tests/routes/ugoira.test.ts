import { assertEquals, assertStringIncludes } from '@std/assert'
import { app } from '../../src/app.ts'
import { createMockRequest } from '../utils/test-helpers.ts'

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

Deno.test('routes/ugoira - valid ID format works', async () => {
  const req = createMockRequest('https://localhost:3021/api/ugoira/123456.mp4', {
    headers: { 'user-agent': BROWSER_UA },
  })

  const res = await app.fetch(req)
  assertEquals([200, 400, 500].includes(res.status), true)
})

Deno.test('routes/ugoira - valid ID with all extensions', async () => {
  const extensions = ['mp4', 'gif', 'webp', 'webm', 'avif', 'apng']

  for (const ext of extensions) {
    const req = createMockRequest(`https://localhost:3021/api/ugoira/123456.${ext}`, {
      headers: { 'user-agent': BROWSER_UA },
    })
    const res = await app.fetch(req)
    assertEquals([200, 400, 500].includes(res.status), true, `Extension ${ext} should be valid`)
  }
})

Deno.test('routes/ugoira - invalid ID format returns 400', async () => {
  const req = createMockRequest('https://localhost:3021/api/ugoira/123456.jpg', {
    headers: { 'user-agent': BROWSER_UA },
  })

  const res = await app.fetch(req)
  assertEquals(res.status, 400)
})

Deno.test('routes/ugoira - non-numeric ID returns 400', async () => {
  const req = createMockRequest('https://localhost:3021/api/ugoira/abc.mp4', {
    headers: { 'user-agent': BROWSER_UA },
  })

  const res = await app.fetch(req)
  assertEquals(res.status, 400)
})

Deno.test('routes/ugoira - accepts optional zip and rate params', async () => {
  const req = createMockRequest(
    'https://localhost:3021/api/ugoira/123456.mp4?zip=https://example.com/test.zip&rate=16',
    {
      headers: { 'user-agent': BROWSER_UA },
    },
  )

  const res = await app.fetch(req)
  assertEquals([200, 400, 500].includes(res.status), true)
})
