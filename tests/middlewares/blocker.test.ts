import { assertEquals } from '@std/assert'
import { blocker, isAllowedOrigin } from '../../src/middlewares/blocker.ts'
import { createMockRequest } from '../utils/test-helpers.ts'

Deno.test('blocker middleware - blocks empty user agent', async () => {
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
  
  assertEquals(blocked, false)
})

Deno.test('blocker middleware - allows uptime bot', async () => {
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
  
  assertEquals(blocked, true)
})

// --- isAllowedOrigin tests ---

Deno.test('isAllowedOrigin - precise match not includes', () => {
  Deno.env.set('ACCEPT_DOMAINS', 'pixiv.net')
  assertEquals(isAllowedOrigin('https://pixiv.net'), true)
  assertEquals(isAllowedOrigin('https://evilpixiv.net.evil.com'), false)
  assertEquals(isAllowedOrigin('https://sub.pixiv.net'), false) // unless *.pixiv.net
})

Deno.test('isAllowedOrigin - wildcard subdomain match', () => {
  Deno.env.set('ACCEPT_DOMAINS', '*.pixiv.net')
  assertEquals(isAllowedOrigin('https://sub.pixiv.net'), true)
  assertEquals(isAllowedOrigin('https://pixiv.net'), true) // bare domain also matches *.domain
  assertEquals(isAllowedOrigin('https://evilpixiv.net.evil.com'), false)
})

Deno.test('isAllowedOrigin - multiple domains', () => {
  Deno.env.set('ACCEPT_DOMAINS', 'pixiv.net, *.pximg.com')
  assertEquals(isAllowedOrigin('https://pixiv.net'), true)
  assertEquals(isAllowedOrigin('https://i.pximg.com'), true)
  assertEquals(isAllowedOrigin('https://sub.pximg.com'), true)
  assertEquals(isAllowedOrigin('https://evil.com'), false)
})

Deno.test('isAllowedOrigin - empty ACCEPT_DOMAINS falls back to allow all', () => {
  Deno.env.set('ACCEPT_DOMAINS', '')
  assertEquals(isAllowedOrigin('https://anything.example.com'), true)
})

Deno.test('isAllowedOrigin - invalid origin returns false', () => {
  Deno.env.set('ACCEPT_DOMAINS', 'pixiv.net')
  assertEquals(isAllowedOrigin('not-a-url'), false)
})