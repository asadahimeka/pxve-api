import { app } from '../../src/app.ts'
import { createMockRequest } from '../utils/test-helpers.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'

test('API Routes - health endpoints', async () => {
  const req = createMockRequest('https://localhost:3021/', {
    headers: { 'user-agent': BROWSER_UA },
  })
  const res = await app.fetch(req)

  assert.deepEqual(res.status, 200)

  const body = await res.text()
  assert.ok(body.includes('Ciallo'))
})

test('API Routes - OpenAPI documentation', async () => {
  const req = createMockRequest('https://localhost:3021/openapi.json', {
    headers: { 'user-agent': BROWSER_UA },
  })
  const res = await app.fetch(req)

  assert.deepEqual(res.status, 200)
  assert.deepEqual(res.headers.get('content-type'), 'application/json')

  const openApiDoc = await res.json()
  assert.deepEqual(openApiDoc.info.title, 'Pxve API')
})

test('API Routes - static files', async () => {
  const robotsReq = createMockRequest('https://localhost:3021/robots.txt')
  const robotsRes = await app.fetch(robotsReq)

  assert.deepEqual(robotsRes.status, 200)
  assert.deepEqual(robotsRes.headers.get('content-type'), 'text/plain; charset=utf-8')

  const faviconReq = createMockRequest('https://localhost:3021/favicon.ico')
  const faviconRes = await app.fetch(faviconReq)

  assert.deepEqual([200, 404].includes(faviconRes.status), true)
})

test('API Routes - error handling', async () => {
  const req = createMockRequest('https://localhost:3021/nonexistent-route', {
    headers: { 'user-agent': BROWSER_UA },
  })
  const res = await app.fetch(req)

  assert.deepEqual(res.status, 404)

  const body = await res.json()
  assert.deepEqual(body.error, 'Not Found')
})

test('API Routes - CORS support', async () => {
  const req = createMockRequest('https://localhost:3021/', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://pixiv.pictures',
      'Access-Control-Request-Method': 'GET',
      'user-agent': BROWSER_UA,
    },
  })

  const res = await app.fetch(req)
  assert.deepEqual(res.status, 204)

  const corsHeader = res.headers.get('access-control-allow-origin')
  assert.deepEqual(corsHeader, 'https://pixiv.pictures')
})

test('API Routes - API documentation endpoints', async () => {
  const scalarReq = createMockRequest('https://localhost:3021/docs', {
    headers: { 'user-agent': BROWSER_UA },
  })
  const scalarRes = await app.fetch(scalarReq)

  assert.deepEqual(scalarRes.status, 200)

  const swaggerReq = createMockRequest('https://localhost:3021/swagger', {
    headers: { 'user-agent': BROWSER_UA },
  })
  const swaggerRes = await app.fetch(swaggerReq)

  assert.deepEqual(swaggerRes.status, 200)

  const swaggerBody = await swaggerRes.text()
  assert.ok(swaggerBody.includes('swagger'))
})
