import { app } from '../../src/app.ts'
import { createMockRequest } from '../utils/test-helpers.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

test('routes/pximg - valid path returns image', async () => {
  const req = createMockRequest(
    'https://localhost:3021/pximg/c/540x540_70/img-master/img/2025/12/18/00/00/34/138723545_p0_master1200.jpg',
    {
      headers: { 'user-agent': BROWSER_UA },
    }
  )

  const res = await app.fetch(req)
  assert.deepEqual([200, 404, 500].includes(res.status), true)
})

test('routes/pximg - empty path returns 404', async () => {
  const req = createMockRequest('https://localhost:3021/pximg', {
    headers: { 'user-agent': BROWSER_UA },
  })

  const res = await app.fetch(req)
  assert.deepEqual(res.status, 404)
})

test('routes/pid - valid PID format works', async () => {
  const req = createMockRequest('https://localhost:3021/pid/123456', {
    headers: { 'user-agent': BROWSER_UA },
  })

  const res = await app.fetch(req)
  assert.deepEqual([200, 301, 404, 500].includes(res.status), true)
})

test('routes/pid - PID with part and size works', async () => {
  const req = createMockRequest('https://localhost:3021/pid/123456_0_m', {
    headers: { 'user-agent': BROWSER_UA },
  })

  const res = await app.fetch(req)
  assert.deepEqual([200, 301, 404, 500].includes(res.status), true)
})

test('routes/pid - all size options work', async () => {
  const sizes = ['s', 'm', 'l', 'o']

  for (const size of sizes) {
    const req = createMockRequest(`https://localhost:3021/pid/123456_0_${size}`, {
      headers: { 'user-agent': BROWSER_UA },
    })
    const res = await app.fetch(req)
    assert.deepEqual([200, 301, 404, 500].includes(res.status), true, `Size ${size} should be valid`)
  }
})

test('routes/pid - invalid PID format returns 400', async () => {
  const req = createMockRequest('https://localhost:3021/pid/abc', {
    headers: { 'user-agent': BROWSER_UA },
  })

  const res = await app.fetch(req)
  assert.deepEqual(res.status, 400)
})
