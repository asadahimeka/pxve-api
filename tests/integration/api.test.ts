import { assertEquals, assertStringIncludes } from '@std/assert'
import { app } from '../../src/app.ts'
import { createMockRequest } from '../utils/test-helpers.ts'

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'

Deno.test('API Integration - basic health check', async () => {
  const req = createMockRequest('https://localhost:3021/', {
    headers: { 'user-agent': BROWSER_UA },
  })
  const res = await app.fetch(req)

  assertEquals(res.status, 200)

  const body = await res.text()
  assertStringIncludes(body, 'Ciallo')
})

Deno.test('API Integration - OpenAPI documentation endpoint', async () => {
  const req = createMockRequest('https://localhost:3021/openapi.json', {
    headers: { 'user-agent': BROWSER_UA },
  })
  const res = await app.fetch(req)

  assertEquals(res.status, 200)
  assertEquals(res.headers.get('content-type'), 'application/json')

  const openApiDoc = await res.json()
  assertEquals(openApiDoc.openapi, '3.1.0')
  assertEquals(openApiDoc.info.title, 'Pxve API')
})

Deno.test('API Integration - robots.txt', async () => {
  const req = createMockRequest('https://localhost:3021/robots.txt')
  const res = await app.fetch(req)

  assertEquals(res.status, 200)
  assertEquals(res.headers.get('content-type'), 'text/plain; charset=utf-8')
})

Deno.test('API Integration - 404 for unknown routes', async () => {
  const req = createMockRequest('https://localhost:3021/unknown-route', {
    headers: { 'user-agent': BROWSER_UA },
  })
  const res = await app.fetch(req)

  assertEquals(res.status, 404)

  const body = await res.json()
  assertEquals(body.error, 'Not Found')
})

Deno.test('API Integration - CORS headers', async () => {
  const req = createMockRequest('https://localhost:3021/', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://pixiv.pictures',
      'Access-Control-Request-Method': 'GET',
      'user-agent': BROWSER_UA,
    },
  })
  const res = await app.fetch(req)

  assertEquals(res.status, 204)
  assertEquals(res.headers.get('access-control-allow-origin'), 'https://pixiv.pictures')
})
