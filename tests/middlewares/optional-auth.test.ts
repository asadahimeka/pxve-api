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
  Deno.env.delete('API_TOKEN')
})
