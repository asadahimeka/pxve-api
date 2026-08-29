import { assertEquals } from '@std/assert'
import { blocker } from '../../src/middlewares/blocker.ts'
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