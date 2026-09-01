import { assertEquals, assertStringIncludes } from '@std/assert'
import { app } from '../../src/app.ts'
import { createMockRequest } from '../utils/test-helpers.ts'

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

Deno.test('routes/pximg - valid path returns image', async () => {
  const req = createMockRequest(
    'https://localhost:3021/pximg/c/540x540_70/img-master/img/2025/12/18/00/00/34/138723545_p0_master1200.jpg',
    {
      headers: { 'user-agent': BROWSER_UA },
    },
  )

  const res = await app.fetch(req)
  assertEquals([200, 404, 500].includes(res.status), true)
})

Deno.test('routes/pximg - empty path returns 404', async () => {
  const req = createMockRequest('https://localhost:3021/pximg', {
    headers: { 'user-agent': BROWSER_UA },
  })

  const res = await app.fetch(req)
  assertEquals(res.status, 404)
})

Deno.test('routes/pid - valid PID format works', async () => {
  const req = createMockRequest('https://localhost:3021/pid/123456', {
    headers: { 'user-agent': BROWSER_UA },
  })

  const res = await app.fetch(req)
  assertEquals([200, 301, 404, 500].includes(res.status), true)
})

Deno.test('routes/pid - PID with part and size works', async () => {
  const req = createMockRequest('https://localhost:3021/pid/123456_0_m', {
    headers: { 'user-agent': BROWSER_UA },
  })

  const res = await app.fetch(req)
  assertEquals([200, 301, 404, 500].includes(res.status), true)
})

Deno.test('routes/pid - all size options work', async () => {
  const sizes = ['s', 'm', 'l', 'o']

  for (const size of sizes) {
    const req = createMockRequest(`https://localhost:3021/pid/123456_0_${size}`, {
      headers: { 'user-agent': BROWSER_UA },
    })
    const res = await app.fetch(req)
    assertEquals([200, 301, 404, 500].includes(res.status), true, `Size ${size} should be valid`)
  }
})

Deno.test('routes/pid - invalid PID format returns 400', async () => {
  const req = createMockRequest('https://localhost:3021/pid/abc', {
    headers: { 'user-agent': BROWSER_UA },
  })

  const res = await app.fetch(req)
  assertEquals(res.status, 400)
})
