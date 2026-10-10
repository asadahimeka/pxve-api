import PixivApi from '../../src/lib/pixiv-api.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('PixivApi - initialization', () => {
  const api = new PixivApi()
  assert.deepEqual(typeof api, 'object')
})

test('PixivApi - basic structure', () => {
  const api = new PixivApi()
  assert.deepEqual(api instanceof PixivApi, true)
  assert.deepEqual(typeof api.illustDetail, 'function')
  assert.deepEqual(typeof api.userDetail, 'function')
})

test('PixivApi - constructor accepts auth object', () => {
  const auth = { access_token: 'test_token', refresh_token: 'refresh_token' }
  const api = new PixivApi(auth)
  assert.deepEqual(api.auth, auth)
})

test('PixivApi - has expected API methods', () => {
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
    assert.deepEqual(typeof api[method as keyof typeof api], 'function', `Method ${method} should exist`)
  }
})

test('PixivApi - setLanguage updates headers', () => {
  const api = new PixivApi()
  api.setLanguage('ja-JP')
  assert.deepEqual(api.headers['Accept-Language'], 'ja-JP')
})

test('PixivApi - getDefaultHeaders returns headers with hash', () => {
  const api = new PixivApi()
  const headers = api.getDefaultHeaders()
  assert.ok(headers['X-Client-Time'] !== null && headers['X-Client-Time'] !== undefined)
  assert.ok(headers['X-Client-Hash'] !== null && headers['X-Client-Hash'] !== undefined)
  assert.deepEqual(headers['App-OS'], 'Android')
})

test('PixivApi - logout clears auth', () => {
  const api = new PixivApi({ access_token: 'test_token' })
  api.logout()
  assert.deepEqual(api.auth, null)
})

test('PixivApi - _loginExpired getter', () => {
  const api = new PixivApi()
  api._expireTime = Date.now() / 1000 + 120
  assert.deepEqual(api._loginExpired, false)
  api._expireTime = Date.now() / 1000 - 120
  assert.deepEqual(api._loginExpired, true)
})

test('PixivApi - illustDetail requires id', async () => {
  const api = new PixivApi()
  try {
    await api.illustDetail('')
    throw new Error('Should have thrown')
  } catch (e) {
    assert.deepEqual(e instanceof Error, true)
    assert.deepEqual((e as Error).message, 'illust_id required')
  }
})

test('PixivApi - userDetail requires id', async () => {
  const api = new PixivApi()
  try {
    await api.userDetail('')
    throw new Error('Should have thrown')
  } catch (e) {
    assert.deepEqual(e instanceof Error, true)
    assert.deepEqual((e as Error).message, 'user_id required')
  }
})

test('PixivApi - searchIllust requires word', async () => {
  const api = new PixivApi()
  try {
    await api.searchIllust('', {})
    throw new Error('Should have thrown')
  } catch (e) {
    assert.deepEqual(e instanceof Error, true)
    assert.deepEqual((e as Error).message, 'word required')
  }
})

test('PixivApi - requestUrl requires url', async () => {
  const api = new PixivApi()
  try {
    await api.requestUrl('')
    throw new Error('Should have thrown')
  } catch (e) {
    assert.deepEqual(e instanceof Error, true)
    assert.deepEqual((e as Error).message, 'url cannot be empty')
  }
})
