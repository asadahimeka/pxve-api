import { Hono } from 'hono'
import { assertEquals } from '@std/assert'
import { optionalAuth } from '../../src/middlewares/optional-auth.ts'

Deno.test('optional auth bypass when empty', async () => {
  Deno.env.delete('API_TOKEN')
  const app = new Hono()
  app.use(optionalAuth())
  app.get('/', c => c.text('ok'))
  assertEquals((await app.request('/')).status, 200)
})

Deno.test('require bearer when set', async () => {
  Deno.env.set('API_TOKEN', 'secret')
  const app = new Hono()
  app.use(optionalAuth())
  app.get('/', c => c.text('ok'))
  assertEquals((await app.request('/')).status, 401)
  assertEquals((await app.request('/', { headers: { Authorization: 'Bearer secret' } })).status, 200)
  assertEquals((await app.request('/', { headers: { Authorization: 'Bearer wrong' } })).status, 401)
  Deno.env.delete('API_TOKEN')
})

Deno.test('accept x-api-token as gateway token', async () => {
  Deno.env.set('API_TOKEN', 'secret')
  const app = new Hono()
  app.use(optionalAuth())
  app.get('/', c => c.text('ok'))
  assertEquals((await app.request('/', { headers: { 'X-Api-Token': 'secret' } })).status, 200)
  assertEquals((await app.request('/', { headers: { 'X-Api-Token': 'Bearer secret' } })).status, 200)
  assertEquals((await app.request('/', { headers: { 'X-Api-Token': 'wrong' } })).status, 401)
  Deno.env.delete('API_TOKEN')
})

Deno.test('allow upstream authorization with x-api-token (proxy scenario)', async () => {
  Deno.env.set('API_TOKEN', 'secret')
  const app = new Hono()
  app.use(optionalAuth())
  // 模拟 pixiv-app-api 代理：Authorization 携带的是 Pixiv access token 而非网关 token
  app.get('/pixiv-app-api/v1/illusts', c => c.text('ok'))
  assertEquals(
    (await app.request('/pixiv-app-api/v1/illusts', {
      headers: { Authorization: 'Bearer pixiv-access-token', 'X-Api-Token': 'secret' },
    })).status,
    200
  )
  // 只带 Pixiv token、不带网关 token 仍然要被拒绝
  assertEquals(
    (await app.request('/pixiv-app-api/v1/illusts', {
      headers: { Authorization: 'Bearer pixiv-access-token' },
    })).status,
    401
  )
  Deno.env.delete('API_TOKEN')
})
