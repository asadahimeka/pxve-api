import assert from 'node:assert/strict'
import { test } from 'node:test'

const shouldSkipCache = (res: Response) => {
  const vary = res.headers.get('Vary')
  if (vary && vary.includes('*')) {
    return true
  }

  const cacheControl = res.headers.get('Cache-Control')
  if (cacheControl && /(?:^|,\s*)(?:private|no-(?:store|cache))(?:\s*(?:=|,|$))/i.test(cacheControl)) {
    return true
  }

  if (res.headers.has('Set-Cookie')) {
    return true
  }

  return false
}

const parseMaxAge = (cacheControl: string | undefined): number | null => {
  if (!cacheControl) return null
  const match = cacheControl.match(/max-age=(\d+)/i)
  return match ? parseInt(match[1], 10) * 1000 : null
}

const getMetadataKey = (key: string): string => {
  return `${key}&__metadata__`
}

test('shouldSkipCache - returns true for Vary: *', () => {
  const response = new Response('test', {
    headers: { Vary: '*' },
  })
  assert.deepEqual(shouldSkipCache(response), true)
})

test('shouldSkipCache - returns true for private cache control', () => {
  const response = new Response('test', {
    headers: { 'Cache-Control': 'private' },
  })
  assert.deepEqual(shouldSkipCache(response), true)
})

test('shouldSkipCache - returns true for no-store cache control', () => {
  const response = new Response('test', {
    headers: { 'Cache-Control': 'no-store' },
  })
  assert.deepEqual(shouldSkipCache(response), true)
})

test('shouldSkipCache - returns true for no-cache cache control', () => {
  const response = new Response('test', {
    headers: { 'Cache-Control': 'no-cache' },
  })
  assert.deepEqual(shouldSkipCache(response), true)
})

test('shouldSkipCache - returns true when Set-Cookie is present', () => {
  const response = new Response('test', {
    headers: { 'Set-Cookie': 'session=abc' },
  })
  assert.deepEqual(shouldSkipCache(response), true)
})

test('shouldSkipCache - returns false for normal cacheable response', () => {
  const response = new Response('test', {
    headers: { 'Cache-Control': 'max-age=3600' },
  })
  assert.deepEqual(shouldSkipCache(response), false)
})

test('parseMaxAge - returns null for undefined', () => {
  const result = parseMaxAge(undefined)
  assert.deepEqual(result, null)
})

test('parseMaxAge - returns null for empty string', () => {
  const result = parseMaxAge('')
  assert.deepEqual(result, null)
})

test('parseMaxAge - parses max-age from cache control header', () => {
  const result = parseMaxAge('max-age=3600')
  assert.deepEqual(result, 3600 * 1000)
})

test('parseMaxAge - parses max-age with other directives', () => {
  const result = parseMaxAge('public, max-age=7200, s-maxage=3600')
  assert.deepEqual(result, 7200 * 1000)
})

test('parseMaxAge - returns null when max-age not present', () => {
  const result = parseMaxAge('public, s-maxage=3600')
  assert.deepEqual(result, null)
})

test('getMetadataKey - generates correct metadata key', () => {
  const key = '/api/test'
  const metadataKey = getMetadataKey(key)
  assert.deepEqual(metadataKey, '/api/test&__metadata__')
})

test('getMetadataKey - handles various URL formats', () => {
  assert.deepEqual(getMetadataKey('http://example.com/api'), 'http://example.com/api&__metadata__')
  assert.deepEqual(getMetadataKey('/path?query=value'), '/path?query=value&__metadata__')
})
