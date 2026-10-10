import { Hono } from 'hono'
import { rateLimit } from '../../src/middlewares/rate-limit.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('rate limit 429', async () => {
  const app = new Hono()
  app.use(rateLimit({ windowMs: 60000, max: 2 }))
  app.get('/', c => c.text('ok'))
  await (await app.request('/')).text()
  await (await app.request('/')).text()
  const r3 = await app.request('/')
  assert.deepEqual(r3.status, 429)
})
