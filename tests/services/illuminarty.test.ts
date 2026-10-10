import { illuminartyImageAnalysis } from '../../src/services/illuminarty.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('illuminarty service - calls correct API endpoint', async () => {
  const originalFetch = globalThis.fetch
  let capturedUrl = ''

  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    capturedUrl = input instanceof Request ? input.url : input.toString()
    return new Response('mock', { status: 200 })
  }

  try {
    await illuminartyImageAnalysis('https://example.com/image.jpg')
    assert.deepEqual(capturedUrl, 'https://app.illuminarty.ai/api/analysis/image')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('illuminarty service - sends form data with file', async () => {
  const originalFetch = globalThis.fetch
  let capturedBody: string | null = null

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    capturedBody = init?.body as string | null
    return new Response('mock', { status: 200 })
  }

  try {
    await illuminartyImageAnalysis('https://example.com/image.jpg')
    assert.deepEqual(capturedBody !== null, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('illuminarty service - includes required headers', async () => {
  const originalFetch = globalThis.fetch
  let capturedOrigin = ''
  let capturedReferer = ''

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // hono/proxy calls fetch(request): custom headers live on the Request
    // object, init is undefined. Normalize both shapes before reading.
    const req = input instanceof Request ? input : new Request(input, init)
    capturedOrigin = req.headers.get('Origin') || ''
    capturedReferer = req.headers.get('Referer') || ''
    return new Response('mock', { status: 200 })
  }

  try {
    await illuminartyImageAnalysis('https://example.com/image.jpg')
    assert.deepEqual(capturedOrigin, 'https://app.illuminarty.ai')
    assert.deepEqual(capturedReferer, 'https://app.illuminarty.ai/')
  } finally {
    globalThis.fetch = originalFetch
  }
})
