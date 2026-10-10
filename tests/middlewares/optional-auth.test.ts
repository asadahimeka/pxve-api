import { Hono } from 'hono'
import { optionalAuth } from '../../src/middlewares/optional-auth.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('optional auth bypass when empty', async () => {
  delete process.env['API_TOKEN']
  const app = new Hono()
  app.use(optionalAuth())
  app.get('/', c => c.text('ok'))
  assert.deepEqual((await app.request('/')).status, 200)
})

test('require bearer when set', async () => {
  process.env['API_TOKEN'] = 'secret'
  const app = new Hono()
  app.use(optionalAuth())
  app.get('/', c => c.text('ok'))
  assert.deepEqual((await app.request('/')).status, 401)
  assert.deepEqual((await app.request('/', { headers: { Authorization: 'Bearer secret' } })).status, 200)
  assert.deepEqual((await app.request('/', { headers: { Authorization: 'Bearer wrong' } })).status, 401)
  delete process.env['API_TOKEN']
})

test('accept x-api-token as gateway token', async () => {
  process.env['API_TOKEN'] = 'secret'
  const app = new Hono()
  app.use(optionalAuth())
  app.get('/', c => c.text('ok'))
  assert.deepEqual((await app.request('/', { headers: { 'X-Api-Token': 'secret' } })).status, 200)
  assert.deepEqual((await app.request('/', { headers: { 'X-Api-Token': 'Bearer secret' } })).status, 200)
  assert.deepEqual((await app.request('/', { headers: { 'X-Api-Token': 'wrong' } })).status, 401)
  delete process.env['API_TOKEN']
})

test('allow upstream authorization with x-api-token (proxy scenario)', async () => {
  process.env['API_TOKEN'] = 'secret'
  const app = new Hono()
  app.use(optionalAuth())
  // 模拟 pixiv-app-api 代理：Authorization 携带的是 Pixiv access token 而非网关 token
  app.get('/pixiv-app-api/v1/illusts', c => c.text('ok'))
  assert.deepEqual(
    (await app.request('/pixiv-app-api/v1/illusts', {
      headers: { Authorization: 'Bearer pixiv-access-token', 'X-Api-Token': 'secret' },
    })).status,
    200
  )
  // 只带 Pixiv token、不带网关 token 仍然要被拒绝
  assert.deepEqual(
    (await app.request('/pixiv-app-api/v1/illusts', {
      headers: { Authorization: 'Bearer pixiv-access-token' },
    })).status,
    401
  )
  delete process.env['API_TOKEN']
})
