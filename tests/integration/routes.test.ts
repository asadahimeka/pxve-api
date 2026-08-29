import { assertEquals, assertStringIncludes } from '@std/assert'
import { app } from '../../src/app.ts'
import { createMockRequest } from '../utils/test-helpers.ts'

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'

Deno.test('API Routes - health endpoints', async () => {
  const req = createMockRequest('https://localhost:3021/', {
    headers: { 'user-agent': BROWSER_UA },
  })
  const res = await app.fetch(req)
  
  assertEquals(res.status, 200)
  
  const body = await res.text()
  assertStringIncludes(body, 'Ciallo')
})

Deno.test('API Routes - OpenAPI documentation', async () => {
  const req = createMockRequest('https://localhost:3021/openapi.json', {
    headers: { 'user-agent': BROWSER_UA },
  })
  const res = await app.fetch(req)
  
  assertEquals(res.status, 200)
  assertEquals(res.headers.get('content-type'), 'application/json')
  
  const openApiDoc = await res.json()
  assertEquals(openApiDoc.info.title, 'Pxve API')
})

Deno.test('API Routes - static files', async () => {
  const robotsReq = createMockRequest('https://localhost:3021/robots.txt')
  const robotsRes = await app.fetch(robotsReq)
  
  assertEquals(robotsRes.status, 200)
  assertEquals(robotsRes.headers.get('content-type'), 'text/plain; charset=utf-8')
  
  const faviconReq = createMockRequest('https://localhost:3021/favicon.ico')
  const faviconRes = await app.fetch(faviconReq)
  
  assertEquals([200, 404].includes(faviconRes.status), true)
})

Deno.test('API Routes - error handling', async () => {
  const req = createMockRequest('https://localhost:3021/nonexistent-route', {
    headers: { 'user-agent': BROWSER_UA },
  })
  const res = await app.fetch(req)
  
  assertEquals(res.status, 404)
  
  const body = await res.json()
  assertEquals(body.error, 'Not Found')
})

Deno.test('API Routes - CORS support', async () => {
  const req = createMockRequest('https://localhost:3021/', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://example.com',
      'Access-Control-Request-Method': 'GET',
      'user-agent': BROWSER_UA,
    },
  })
  
  const res = await app.fetch(req)
  assertEquals(res.status, 204)
  
  const corsHeader = res.headers.get('access-control-allow-origin')
  assertEquals(corsHeader !== null, true)
})

Deno.test('API Routes - API documentation endpoints', async () => {
  const scalarReq = createMockRequest('https://localhost:3021/docs', {
    headers: { 'user-agent': BROWSER_UA },
  })
  const scalarRes = await app.fetch(scalarReq)
  
  assertEquals(scalarRes.status, 200)
  
  const swaggerReq = createMockRequest('https://localhost:3021/swagger', {
    headers: { 'user-agent': BROWSER_UA },
  })
  const swaggerRes = await app.fetch(swaggerReq)
  
  assertEquals(swaggerRes.status, 200)
  
  const swaggerBody = await swaggerRes.text()
  assertStringIncludes(swaggerBody, 'swagger')
})