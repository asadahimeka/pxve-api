import { assertEquals } from '@std/assert'
import { Hono } from 'hono'
import { commonProxy } from '../../src/services/proxy.ts'
import { createMockRequest } from '../utils/test-helpers.ts'

Deno.test('proxy service - basic proxy functionality', async () => {
  const mockContent = 'proxied content'

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const urlStr = input instanceof Request ? input.url : typeof input === 'string' ? input : input.toString()
    if (urlStr.includes('example.com/target')) {
      return new Response(mockContent, {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      })
    }
    return new Response('Not Found', { status: 404 })
  }

  try {
    const req = createMockRequest('https://localhost:3021/proxy/https://example.com/target')

    const result = await commonProxy(req)

    assertEquals(result.status, 200)
    assertEquals(await result.text(), 'proxied content')
    assertEquals(result.headers.get('content-type'), 'text/plain')
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('proxy blocks private (192.168.1.1)', async () => {
  const { proxyRoute } = await import('../../src/routes/cors-proxy/index.ts')
  const app = new Hono()
  app.route('/', proxyRoute)
  const r = await app.request('/proxy/http://192.168.1.1/secret')
  assertEquals(r.status, 400)
})

Deno.test('proxy blocks metadata endpoint (169.254.169.254)', async () => {
  const { proxyRoute } = await import('../../src/routes/cors-proxy/index.ts')
  const app = new Hono()
  app.route('/', proxyRoute)
  const r = await app.request('/proxy/http://169.254.169.254/latest/meta-data/')
  assertEquals(r.status, 400)
})

Deno.test('proxy blocks localhost (127.0.0.1)', async () => {
  const { proxyRoute } = await import('../../src/routes/cors-proxy/index.ts')
  const app = new Hono()
  app.route('/', proxyRoute)
  const r = await app.request('/proxy/http://127.0.0.1:3021/internal')
  assertEquals(r.status, 400)
})

Deno.test('proxy blocks file:// protocol', async () => {
  const { proxyRoute } = await import('../../src/routes/cors-proxy/index.ts')
  const app = new Hono()
  app.route('/', proxyRoute)
  const r = await app.request('/proxy/file:///etc/passwd')
  assertEquals(r.status, 400)
})

Deno.test('proxy blocks ip echo service (httpbin.org)', async () => {
  const { proxyRoute } = await import('../../src/routes/cors-proxy/index.ts')
  const app = new Hono()
  app.route('/', proxyRoute)
  const r = await app.request('/proxy/https://httpbin.org/ip')
  assertEquals(r.status, 400)
  assertEquals((await r.json()).error, 'blocked ip-echo domain: httpbin.org')
})

Deno.test('proxy blocks ip echo subdomain (api.ipify.org)', async () => {
  const { proxyRoute } = await import('../../src/routes/cors-proxy/index.ts')
  const app = new Hono()
  app.route('/', proxyRoute)
  const r = await app.request('/proxy/https://api.ipify.org?format=json')
  assertEquals(r.status, 400)
  assertEquals((await r.json()).error, 'blocked ip-echo domain: api.ipify.org')
})

Deno.test('proxy allows ip echo when PROXY_ALLOW_IP_ECHO=1', async () => {
  Deno.env.set('PROXY_ALLOW_IP_ECHO', '1')
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (): Promise<Response> => {
    return new Response('{"origin":"203.0.113.7"}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const { proxyRoute } = await import('../../src/routes/cors-proxy/index.ts')
    const app = new Hono()
    app.route('/', proxyRoute)
    const r = await app.request('/proxy/https://httpbin.org/ip')
    assertEquals(r.status, 200)
    assertEquals(await r.text(), '{"origin":"203.0.113.7"}')
  } finally {
    Deno.env.delete('PROXY_ALLOW_IP_ECHO')
    globalThis.fetch = originalFetch
  }
})

Deno.test('proxy service - handles HTTP errors', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (): Promise<Response> => {
    return new Response('Not Found', { status: 404 })
  }

  try {
    const req = createMockRequest('https://localhost:3021/proxy/https://example.com/not-found')

    const result = await commonProxy(req)
    assertEquals(result.status, 404)
  } finally {
    globalThis.fetch = originalFetch
  }
})
