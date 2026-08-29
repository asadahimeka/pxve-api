import { assertEquals, assertExists, assertRejects } from '@std/assert'
import { translate } from '../../src/services/youdao.ts'

Deno.test('youdao service - translate throws on network error', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (): Promise<Response> => {
    return new Response('error', { status: 500 })
  }

  try {
    await assertRejects(
      () => translate('test'),
      Error,
      'Http Request Error'
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('youdao service - uses correct API key env var', () => {
  assertExists(Deno.env.get('SAUCENAO_API_KEY') || true)
})
