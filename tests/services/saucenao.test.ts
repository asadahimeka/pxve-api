import { assertEquals, assertRejects } from '@std/assert'
import { saucenaoSearch } from '../../src/services/saucenao.ts'

Deno.test('saucenao service - handles string URL input', async () => {
  const originalEnv = Deno.env.get('SAUCENAO_API_KEY')
  Deno.env.set('SAUCENAO_API_KEY', 'test-api-key')

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_input: RequestInfo | URL): Promise<Response> => {
    return new Response('mock response', { status: 200 })
  }

  try {
    const result = await saucenaoSearch('https://example.com/image.jpg')
    assertEquals(result.status, 200)
  } finally {
    globalThis.fetch = originalFetch
    if (originalEnv !== undefined) {
      Deno.env.set('SAUCENAO_API_KEY', originalEnv)
    } else {
      Deno.env.delete('SAUCENAO_API_KEY')
    }
  }
})

Deno.test('saucenao service - handles Blob input', async () => {
  const originalEnv = Deno.env.get('SAUCENAO_API_KEY')
  Deno.env.set('SAUCENAO_API_KEY', 'test-api-key')

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_input: RequestInfo | URL): Promise<Response> => {
    return new Response('mock response', { status: 200 })
  }

  try {
    const blob = new Blob(['test image data'], { type: 'image/jpeg' })
    const result = await saucenaoSearch(blob)
    assertEquals(result.status, 200)
  } finally {
    globalThis.fetch = originalFetch
    if (originalEnv !== undefined) {
      Deno.env.set('SAUCENAO_API_KEY', originalEnv)
    } else {
      Deno.env.delete('SAUCENAO_API_KEY')
    }
  }
})
