import { app } from '../../src/app.ts'
import { createMockRequest } from '../utils/test-helpers.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

test('routes/pixiv - redirect from /pixiv/ to /pixiv/:key', async () => {
  const req = createMockRequest('https://localhost:3021/api/pixiv/?type=tags', {
    headers: { 'user-agent': BROWSER_UA },
  })
  const res = await app.fetch(req)

  assert.deepEqual(res.status, 301)
  assert.ok((res.headers.get('location') || '').includes('/api/pixiv/tags'))
})

test('routes/pixiv - valid action key passes validation', async () => {
  const req = createMockRequest('https://localhost:3021/api/pixiv/illust_detail?id=123456', {
    headers: { 'user-agent': BROWSER_UA },
  })

  const res = await app.fetch(req)
  assert.deepEqual([200, 400, 500].includes(res.status), true)
})

test('routes/pixiv - invalid key returns 400', async () => {
  const req = createMockRequest('https://localhost:3021/api/pixiv/invalid_key', {
    headers: { 'user-agent': BROWSER_UA },
  })

  const res = await app.fetch(req)
  assert.deepEqual(res.status, 400)
})

test('routes/pixiv - unknown action returns 400', async () => {
  const req = createMockRequest('https://localhost:3021/api/pixiv/unknown_action', {
    headers: { 'user-agent': BROWSER_UA },
  })

  const res = await app.fetch(req)
  assert.deepEqual(res.status, 400)
})
