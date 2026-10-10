import { pixivApiProxy } from '../../../src/services/pixiv/api-proxy.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('pixiv-api-proxy - throws on unknown path', async () => {
  await assert.rejects(
    () => pixivApiProxy('https://example.com/unknown/path', new Request('https://example.com/')),
    (e: unknown) => e instanceof Error && e.message.includes('Not found')
  )
})

test('pixiv-api-proxy - routes /pixiv-app-api to app-api.pixiv.net', async () => {
  const originalFetch = globalThis.fetch
  let capturedUrl = ''

  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    capturedUrl = input instanceof Request ? input.url : input.toString()
    return new Response('mock', { status: 200 })
  }

  try {
    await pixivApiProxy('https://example.com/pixiv-app-api/v1/user/me', new Request('https://example.com/'))
    assert.deepEqual(capturedUrl.includes('app-api.pixiv.net'), true)
    assert.deepEqual(capturedUrl.includes('/v1/user/me'), true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('pixiv-api-proxy - routes /pixiv-oauth to oauth.secure.pixiv.net', async () => {
  const originalFetch = globalThis.fetch
  let capturedUrl = ''

  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    capturedUrl = input instanceof Request ? input.url : input.toString()
    return new Response('mock', { status: 200 })
  }

  try {
    await pixivApiProxy('https://example.com/pixiv-oauth/token', new Request('https://example.com/'))
    assert.deepEqual(capturedUrl.includes('oauth.secure.pixiv.net'), true)
    assert.deepEqual(capturedUrl.includes('/token'), true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('pixiv-api-proxy - forwards auth headers', async () => {
  const originalFetch = globalThis.fetch
  let capturedHeaders: Record<string, string> = {}

  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // hono/proxy calls fetch(request): forwarded headers live on the Request
    // object, init is undefined. Normalize both shapes before reading.
    const req = _input instanceof Request ? _input : new Request(_input, init)
    capturedHeaders = {
      'Authorization': req.headers.get('Authorization') || '',
      'X-Client-Time': req.headers.get('X-Client-Time') || '',
      'X-Client-Hash': req.headers.get('X-Client-Hash') || '',
    }
    return new Response('mock', { status: 200 })
  }

  try {
    const req = new Request('https://example.com/', {
      headers: {
        'Authorization': 'Bearer test-token',
        'X-Client-Time': '2024-01-01T00:00:00Z',
        'X-Client-Hash': 'abc123',
      },
    })
    await pixivApiProxy('https://example.com/pixiv-app-api/v1/user/me', req)
    assert.deepEqual(capturedHeaders['Authorization'], 'Bearer test-token')
    assert.deepEqual(capturedHeaders['X-Client-Time'], '2024-01-01T00:00:00Z')
    assert.deepEqual(capturedHeaders['X-Client-Hash'], 'abc123')
  } finally {
    globalThis.fetch = originalFetch
  }
})
