import { assertEquals, assertRejects } from '@std/assert'
import { pixivApiProxy } from '../../../src/services/pixiv/api-proxy.ts'

Deno.test('pixiv-api-proxy - throws on unknown path', async () => {
  await assertRejects(
    () => pixivApiProxy('https://example.com/unknown/path', new Request('https://example.com/')),
    Error,
    'Not found'
  )
})

Deno.test('pixiv-api-proxy - routes /pixiv-app-api to app-api.pixiv.net', async () => {
  const originalFetch = globalThis.fetch
  let capturedUrl = ''
  
  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    capturedUrl = input instanceof Request ? input.url : input.toString()
    return new Response('mock', { status: 200 })
  }

  try {
    await pixivApiProxy('https://example.com/pixiv-app-api/v1/user/me', new Request('https://example.com/'))
    assertEquals(capturedUrl.includes('app-api.pixiv.net'), true)
    assertEquals(capturedUrl.includes('/v1/user/me'), true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('pixiv-api-proxy - routes /pixiv-oauth to oauth.secure.pixiv.net', async () => {
  const originalFetch = globalThis.fetch
  let capturedUrl = ''
  
  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    capturedUrl = input instanceof Request ? input.url : input.toString()
    return new Response('mock', { status: 200 })
  }

  try {
    await pixivApiProxy('https://example.com/pixiv-oauth/token', new Request('https://example.com/'))
    assertEquals(capturedUrl.includes('oauth.secure.pixiv.net'), true)
    assertEquals(capturedUrl.includes('/token'), true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('pixiv-api-proxy - forwards auth headers', async () => {
  const originalFetch = globalThis.fetch
  let capturedHeaders: Record<string, string> = {}
  
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    capturedHeaders = init?.headers as Record<string, string> || {}
    return new Response('mock', { status: 200 })
  }

  try {
    const req = new Request('https://example.com/', {
      headers: {
        'Authorization': 'Bearer test-token',
        'X-Client-Time': '2024-01-01T00:00:00Z',
        'X-Client-Hash': 'abc123',
      }
    })
    await pixivApiProxy('https://example.com/pixiv-app-api/v1/user/me', req)
    assertEquals(capturedHeaders['Authorization'], 'Bearer test-token')
    assertEquals(capturedHeaders['X-Client-Time'], '2024-01-01T00:00:00Z')
    assertEquals(capturedHeaders['X-Client-Hash'], 'abc123')
  } finally {
    globalThis.fetch = originalFetch
  }
})
