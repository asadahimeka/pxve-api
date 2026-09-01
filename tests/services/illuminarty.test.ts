import { assertEquals, assertRejects } from '@std/assert'
import { illuminartyImageAnalysis } from '../../src/services/illuminarty.ts'

Deno.test('illuminarty service - calls correct API endpoint', async () => {
  const originalFetch = globalThis.fetch
  let capturedUrl = ''

  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    capturedUrl = input instanceof Request ? input.url : input.toString()
    return new Response('mock', { status: 200 })
  }

  try {
    await illuminartyImageAnalysis('https://example.com/image.jpg')
    assertEquals(capturedUrl, 'https://app.illuminarty.ai/api/analysis/image')
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('illuminarty service - sends form data with file', async () => {
  const originalFetch = globalThis.fetch
  let capturedBody: string | null = null

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    capturedBody = init?.body as string | null
    return new Response('mock', { status: 200 })
  }

  try {
    await illuminartyImageAnalysis('https://example.com/image.jpg')
    assertEquals(capturedBody !== null, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('illuminarty service - includes required headers', async () => {
  const originalFetch = globalThis.fetch
  let capturedOrigin = ''
  let capturedReferer = ''

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers = init?.headers as Record<string, string> | undefined
    capturedOrigin = headers?.Origin || ''
    capturedReferer = headers?.Referer || ''
    return new Response('mock', { status: 200 })
  }

  try {
    await illuminartyImageAnalysis('https://example.com/image.jpg')
    assertEquals(capturedOrigin, 'https://app.illuminarty.ai')
    assertEquals(capturedReferer, 'https://app.illuminarty.ai/')
  } finally {
    globalThis.fetch = originalFetch
  }
})
