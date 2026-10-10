import { saucenaoSearch } from '../../src/services/saucenao.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('saucenao service - handles string URL input', async () => {
  const originalEnv = process.env['SAUCENAO_API_KEY']
  process.env['SAUCENAO_API_KEY'] = 'test-api-key'

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_input: RequestInfo | URL): Promise<Response> => {
    return new Response('mock response', { status: 200 })
  }

  try {
    const result = await saucenaoSearch('https://example.com/image.jpg')
    assert.deepEqual(result.status, 200)
  } finally {
    globalThis.fetch = originalFetch
    if (originalEnv !== undefined) {
      process.env['SAUCENAO_API_KEY'] = originalEnv
    } else {
      delete process.env['SAUCENAO_API_KEY']
    }
  }
})

test('saucenao service - handles Blob input', async () => {
  const originalEnv = process.env['SAUCENAO_API_KEY']
  process.env['SAUCENAO_API_KEY'] = 'test-api-key'

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_input: RequestInfo | URL): Promise<Response> => {
    return new Response('mock response', { status: 200 })
  }

  try {
    const blob = new Blob(['test image data'], { type: 'image/jpeg' })
    const result = await saucenaoSearch(blob)
    assert.deepEqual(result.status, 200)
  } finally {
    globalThis.fetch = originalFetch
    if (originalEnv !== undefined) {
      process.env['SAUCENAO_API_KEY'] = originalEnv
    } else {
      delete process.env['SAUCENAO_API_KEY']
    }
  }
})
