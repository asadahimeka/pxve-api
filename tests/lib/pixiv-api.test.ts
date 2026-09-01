import { assertEquals, assertExists } from '@std/assert'
import PixivApi from '../../src/lib/pixiv-api.ts'

Deno.test('PixivApi - initialization', () => {
  const api = new PixivApi()
  assertEquals(typeof api, 'object')
})

Deno.test('PixivApi - basic structure', () => {
  const api = new PixivApi()
  assertEquals(api instanceof PixivApi, true)
  assertEquals(typeof api.illustDetail, 'function')
  assertEquals(typeof api.userDetail, 'function')
})

Deno.test('PixivApi - constructor accepts auth object', () => {
  const auth = { access_token: 'test_token', refresh_token: 'refresh_token' }
  const api = new PixivApi(auth)
  assertEquals(api.auth, auth)
})

Deno.test('PixivApi - has expected API methods', () => {
  const api = new PixivApi()
  const expectedMethods = [
    'illustDetail',
    'userDetail',
    'searchIllust',
    'userIllusts',
    'illustComments',
    'ugoiraMetaData',
    'novelDetail',
    'illustRanking',
    'bookmarkIllust',
    'logout',
  ]
  for (const method of expectedMethods) {
    assertEquals(typeof api[method as keyof typeof api], 'function', `Method ${method} should exist`)
  }
})

Deno.test('PixivApi - setLanguage updates headers', () => {
  const api = new PixivApi()
  api.setLanguage('ja-JP')
  assertEquals(api.headers['Accept-Language'], 'ja-JP')
})

Deno.test('PixivApi - getDefaultHeaders returns headers with hash', () => {
  const api = new PixivApi()
  const headers = api.getDefaultHeaders()
  assertExists(headers['X-Client-Time'])
  assertExists(headers['X-Client-Hash'])
  assertEquals(headers['App-OS'], 'Android')
})

Deno.test('PixivApi - logout clears auth', () => {
  const api = new PixivApi({ access_token: 'test_token' })
  api.logout()
  assertEquals(api.auth, null)
})

Deno.test('PixivApi - _loginExpired getter', () => {
  const api = new PixivApi()
  api._expireTime = Date.now() / 1000 + 120
  assertEquals(api._loginExpired, false)
  api._expireTime = Date.now() / 1000 - 120
  assertEquals(api._loginExpired, true)
})

Deno.test('PixivApi - illustDetail requires id', async () => {
  const api = new PixivApi()
  try {
    await api.illustDetail('')
    throw new Error('Should have thrown')
  } catch (e) {
    assertEquals(e instanceof Error, true)
    assertEquals((e as Error).message, 'illust_id required')
  }
})

Deno.test('PixivApi - userDetail requires id', async () => {
  const api = new PixivApi()
  try {
    await api.userDetail('')
    throw new Error('Should have thrown')
  } catch (e) {
    assertEquals(e instanceof Error, true)
    assertEquals((e as Error).message, 'user_id required')
  }
})

Deno.test('PixivApi - searchIllust requires word', async () => {
  const api = new PixivApi()
  try {
    await api.searchIllust('', {})
    throw new Error('Should have thrown')
  } catch (e) {
    assertEquals(e instanceof Error, true)
    assertEquals((e as Error).message, 'word required')
  }
})

Deno.test('PixivApi - requestUrl requires url', async () => {
  const api = new PixivApi()
  try {
    await api.requestUrl('')
    throw new Error('Should have thrown')
  } catch (e) {
    assertEquals(e instanceof Error, true)
    assertEquals((e as Error).message, 'url cannot be empty')
  }
})
