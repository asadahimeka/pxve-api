import { blocker, isAllowedOrigin } from '../../src/middlewares/blocker.ts'
import { createMockRequest } from '../utils/test-helpers.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('blocker middleware - blocks empty user agent', async () => {
  const middleware = blocker()

  const noUaReq = createMockRequest('https://example.com/api/test')

  const mockCtx = {
    req: {
      header: (name: string) => noUaReq.headers.get(name),
      path: '/api/test',
    },
    json: (data: any, status: number) => new Response(JSON.stringify(data), { status }),
  }

  let blocked = false
  const next = async () => {
    blocked = true
  }

  await middleware(mockCtx as any, next)

  assert.deepEqual(blocked, false)
})

test('blocker middleware - allows uptime bot', async () => {
  const middleware = blocker()

  const uptimeReq = createMockRequest('https://example.com/api/test', {
    headers: { 'user-agent': 'Uptimebot/1.0' },
  })

  const mockCtx = {
    req: {
      header: (name: string) => uptimeReq.headers.get(name),
      path: '/api/test',
    },
    json: (data: any, status: number) => new Response(JSON.stringify(data), { status }),
  }

  let blocked = false
  const next = async () => {
    blocked = true
  }

  await middleware(mockCtx as any, next)

  assert.deepEqual(blocked, true)
})

// --- isAllowedOrigin tests ---

test('isAllowedOrigin - precise match not includes', () => {
  process.env['ACCEPT_DOMAINS'] = 'pixiv.net'
  assert.deepEqual(isAllowedOrigin('https://pixiv.net'), true)
  assert.deepEqual(isAllowedOrigin('https://evilpixiv.net.evil.com'), false)
  assert.deepEqual(isAllowedOrigin('https://sub.pixiv.net'), false) // unless *.pixiv.net
})

test('isAllowedOrigin - wildcard subdomain match', () => {
  process.env['ACCEPT_DOMAINS'] = '*.pixiv.net'
  assert.deepEqual(isAllowedOrigin('https://sub.pixiv.net'), true)
  assert.deepEqual(isAllowedOrigin('https://pixiv.net'), true) // bare domain also matches *.domain
  assert.deepEqual(isAllowedOrigin('https://evilpixiv.net.evil.com'), false)
})

test('isAllowedOrigin - multiple domains', () => {
  process.env['ACCEPT_DOMAINS'] = 'pixiv.net, *.pximg.com'
  assert.deepEqual(isAllowedOrigin('https://pixiv.net'), true)
  assert.deepEqual(isAllowedOrigin('https://i.pximg.com'), true)
  assert.deepEqual(isAllowedOrigin('https://sub.pximg.com'), true)
  assert.deepEqual(isAllowedOrigin('https://evil.com'), false)
})

test('isAllowedOrigin - empty ACCEPT_DOMAINS falls back to allow all', () => {
  process.env['ACCEPT_DOMAINS'] = ''
  assert.deepEqual(isAllowedOrigin('https://anything.example.com'), true)
})

test('isAllowedOrigin - invalid origin returns false', () => {
  process.env['ACCEPT_DOMAINS'] = 'pixiv.net'
  assert.deepEqual(isAllowedOrigin('not-a-url'), false)
})
