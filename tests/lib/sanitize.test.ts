import { sanitizeError, sanitizeUrl } from '#lib/sanitize.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('sanitize api_key', () => {
  assert.deepEqual(
    sanitizeUrl('https://saucenao.com/search.php?api_key=secret&url=https://a.com/x.jpg'),
    'https://saucenao.com/search.php?api_key=***&url=https://a.com/x.jpg'
  )
})

test('sanitize case-insensitive variants', () => {
  // API_KEY (uppercase) should also be sanitized — regression for case-sensitivity leak
  assert.deepEqual(sanitizeUrl('https://x.com/?API_KEY=secret&foo=bar'), 'https://x.com/?API_KEY=***&foo=bar')
  // Token (capital T)
  assert.deepEqual(sanitizeUrl('https://x.com/?Token=tok123&page=1'), 'https://x.com/?Token=***&page=1')
  // PHPSESSID mixed case
  assert.deepEqual(sanitizeUrl('https://x.com/?PHPSESSID=abc123&q=test'), 'https://x.com/?PHPSESSID=***&q=test')
  // phpsessid (all lowercase)
  assert.deepEqual(sanitizeUrl('https://x.com/?phpsessid=abc123&q=test'), 'https://x.com/?phpsessid=***&q=test')
})

test('sanitize extended key patterns', () => {
  assert.deepEqual(sanitizeUrl('https://x.com/?key=secret&foo=bar'), 'https://x.com/?key=***&foo=bar')
  assert.deepEqual(sanitizeUrl('https://x.com/?access_token=abc123&page=1'), 'https://x.com/?access_token=***&page=1')
  assert.deepEqual(sanitizeUrl('https://x.com/?auth_token=tok&bar=1'), 'https://x.com/?auth_token=***&bar=1')
  assert.deepEqual(sanitizeUrl('https://x.com/?secret=xyz&id=5'), 'https://x.com/?secret=***&id=5')
  assert.deepEqual(sanitizeUrl('https://x.com/?password=12345&user=a'), 'https://x.com/?password=***&user=a')
})

test('sanitizeError masks sensitive query in Error.message', () => {
  const msg = sanitizeError(new Error('request to https://x.com/?api_key=secret failed'))
  assert.deepEqual(msg, 'request to https://x.com/?api_key=*** failed')
})

test('sanitizeError handles non-Error values', () => {
  const msg = sanitizeError('token=abc123 was invalid')
  assert.deepEqual(msg, 'token=*** was invalid')
})

test('sanitizeError handles plain strings without sensitive data', () => {
  const msg = sanitizeError('something broke')
  assert.deepEqual(msg, 'something broke')
})
