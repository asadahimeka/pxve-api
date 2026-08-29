import { assertEquals, assertStringIncludes } from '@std/assert'
import { logger } from '../../src/middlewares/logger.ts'
import { createMockRequest } from '../utils/test-helpers.ts'

Deno.test('logger middleware - logs requests properly', async () => {
  const logs: string[] = []
  const originalConsoleLog = console.log
  
  console.log = (...args: any[]) => {
    logs.push(args.join(' '))
  }

  try {
    const middleware = logger()
    const req = createMockRequest('https://example.com/api/test', {
      headers: { 'user-agent': 'TestAgent' },
    })
    
    const mockCtx = {
      req: {
        header: (name: string) => req.headers.get(name),
        method: 'GET',
        url: 'https://example.com/api/test',
      },
      res: new Response('test', { status: 200 }),
      header: () => {},
    }
    
    const next = async () => {
      mockCtx.res = new Response('test', { status: 200 })
    }

    await middleware(mockCtx as any, next)

    console.log = originalConsoleLog

    assertEquals(logs.length, 1)
    assertStringIncludes(logs[0], 'GET')
    assertStringIncludes(logs[0], '200')
  } catch (error) {
    console.log = originalConsoleLog
    throw error
  }
})