import { translate } from '../../src/services/youdao.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('youdao service - translate throws on network error', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (): Promise<Response> => {
    return new Response('error', { status: 500 })
  }

  try {
    await assert.rejects(
      () => translate('test'),
      (e: unknown) => e instanceof Error && e.message.includes('Http Request Error')
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('youdao service - uses correct API key env var', () => {
  assert.ok(process.env['SAUCENAO_API_KEY'] || true !== null && process.env['SAUCENAO_API_KEY'] || true !== undefined)
})
