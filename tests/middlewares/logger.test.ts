import { logger } from '../../src/middlewares/logger.ts'
import { createMockRequest } from '../utils/test-helpers.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('logger middleware - logs requests properly', async () => {
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

    assert.deepEqual(logs.length, 1)
    assert.ok(logs[0].includes('GET'))
    assert.ok(logs[0].includes('200'))
  } catch (error) {
    console.log = originalConsoleLog
    throw error
  }
})
