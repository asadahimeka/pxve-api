import { assertEquals, assertStringIncludes } from '@std/assert'

/**
 * Test utility functions for Pxve API testing
 */

export interface TestResponse {
  status: number
  headers: Headers
  body: string
  json: () => Promise<any>
}

/**
 * Create a mock Response object for testing
 */
export function createMockResponse(
  body: string | object,
  status = 200,
  headers: Record<string, string> = {}
): TestResponse {
  const response = new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: new Headers(headers),
  })

  return {
    status: response.status,
    headers: response.headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  }
}

/**
 * Create a mock Request object for testing
 */
export function createMockRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, {
    headers: {
      'user-agent': 'test-agent',
      ...options.headers,
    },
    ...options,
  })
}

/**
 * Create a mock Hono context for testing
 */
export function createMockContext(req: Request, env: Record<string, string> = {}) {
  const headers = new Headers()
  const status = 200

  return {
    req,
    env,
    headers,
    status,
    json: (data: any, statusArg?: number) => {
      const responseStatus = statusArg || status
      return new Response(JSON.stringify(data), {
        status: responseStatus,
        headers: { 'content-type': 'application/json' },
      })
    },
    text: (text: string, statusArg?: number) => {
      const responseStatus = statusArg || status
      return new Response(text, { status: responseStatus })
    },
    valid: (type: 'query' | 'json' | 'param') => {
      if (type === 'query') {
        const url = new URL(req.url)
        const params: Record<string, string> = {}
        url.searchParams.forEach((value, key) => {
          params[key] = value
        })
        return params
      }
      return {}
    },
  }
}

/**
 * Wait for a specified number of milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Assert that a response contains expected properties
 */
export function assertApiResponse(response: TestResponse, expectedStatus: number, expectedFields?: string[]) {
  assertEquals(response.status, expectedStatus)

  if (expectedFields && response.status === 200) {
    const jsonData = JSON.parse(response.body)
    for (const field of expectedFields) {
      if (!(field in jsonData)) {
        throw new Error(`Expected field '${field}' not found in response`)
      }
    }
  }
}

/**
 * Test environment setup utilities
 */
export class TestEnvironment {
  private originalEnv: Record<string, string | undefined> = {}

  setEnv(key: string, value: string) {
    this.originalEnv[key] = Deno.env.get(key)
    Deno.env.set(key, value)
  }

  restoreEnv() {
    for (const [key, value] of Object.entries(this.originalEnv)) {
      if (value === undefined) {
        Deno.env.delete(key)
      } else {
        Deno.env.set(key, value)
      }
    }
    this.originalEnv = {}
  }

  cleanup() {
    this.restoreEnv()
  }
}

/**
 * Mock fetch utility for testing HTTP requests
 */
export function createMockFetch(responses: Array<{ url: string; response: Response }>) {
  const originalFetch = globalThis.fetch

  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString()
    const mockResponse = responses.find(r => r.url === url)

    if (mockResponse) {
      return mockResponse.response
    }

    // Return 404 for unmatched URLs
    return new Response('Not Found', { status: 404 })
  }

  globalThis.fetch = mockFetch

  return () => {
    globalThis.fetch = originalFetch
  }
}
