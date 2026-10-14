import { Hono } from 'hono'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pixivNowRoute } from '../../src/routes/pixiv/pixiv-now.ts'

function createApp() {
  return new Hono().route('/api', pixivNowRoute)
}

/** Replace global fetch with a recorder stub; never touches the network. */
function stubFetch() {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: typeof input === 'string' ? input : input.toString(), init })
    return new Response(JSON.stringify({ body: { ok: true } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  return { calls, restore: () => (globalThis.fetch = original) }
}

test('pixiv-now route - POST without credentials is rejected with 401 and never reaches upstream', async () => {
  const app = createApp()
  const { calls, restore } = stubFetch()
  try {
    const res = await app.request('/api/pixiv-now/http/ajax/illust/bookmarks', { method: 'POST' })
    assert.equal(res.status, 401, 'POST without x-auth/PHPSESSID must be rejected')
    assert.equal(calls.length, 0, 'rejected POST must not trigger any upstream fetch (server cookie must not be used for writes)')
  } finally {
    restore()
  }
})

test('pixiv-now route - POST with x-auth header forwards the client cookie upstream', async () => {
  const app = createApp()
  const { calls, restore } = stubFetch()
  try {
    const res = await app.request('/api/pixiv-now/http/ajax/illust/bookmarks', {
      method: 'POST',
      headers: { 'x-auth': 'PHPSESSID=11111_xxxxxxx' },
    })
    assert.equal(res.status, 200)
    assert.equal(calls.length, 1, 'credentialed POST should be forwarded exactly once')
    const forwardedCookie = (calls[0].init?.headers as Record<string, string>)?.cookie
    assert.equal(forwardedCookie, 'PHPSESSID=11111_xxxxxxx', 'upstream must receive the client-supplied cookie, not the server one')
  } finally {
    restore()
  }
})

test('pixiv-now route - POST with PHPSESSID cookie is forwarded (cookie counts as credentials)', async () => {
  const app = createApp()
  const { calls, restore } = stubFetch()
  try {
    const res = await app.request('/api/pixiv-now/http/ajax/illust/bookmarks', {
      method: 'POST',
      headers: { cookie: 'PHPSESSID=99999_yyyyyyy' },
    })
    assert.equal(res.status, 200)
    assert.equal(calls.length, 1)
    const forwardedCookie = (calls[0].init?.headers as Record<string, string>)?.cookie
    assert.equal(forwardedCookie, 'PHPSESSID=99999_yyyyyyy')
  } finally {
    restore()
  }
})
