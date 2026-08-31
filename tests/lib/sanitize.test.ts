import { assertEquals } from '@std/assert'
import { sanitizeUrl, sanitizeError } from '@lib/sanitize.ts'

Deno.test('sanitize api_key', () => {
  assertEquals(
    sanitizeUrl('https://saucenao.com/search.php?api_key=secret&url=https://a.com/x.jpg'),
    'https://saucenao.com/search.php?api_key=***&url=https://a.com/x.jpg',
  )
})

Deno.test('sanitize case-insensitive variants', () => {
  // API_KEY (uppercase) should also be sanitized — regression for case-sensitivity leak
  assertEquals(
    sanitizeUrl('https://x.com/?API_KEY=secret&foo=bar'),
    'https://x.com/?API_KEY=***&foo=bar',
  )
  // Token (capital T)
  assertEquals(
    sanitizeUrl('https://x.com/?Token=tok123&page=1'),
    'https://x.com/?Token=***&page=1',
  )
  // PHPSESSID mixed case
  assertEquals(
    sanitizeUrl('https://x.com/?PHPSESSID=abc123&q=test'),
    'https://x.com/?PHPSESSID=***&q=test',
  )
  // phpsessid (all lowercase)
  assertEquals(
    sanitizeUrl('https://x.com/?phpsessid=abc123&q=test'),
    'https://x.com/?phpsessid=***&q=test',
  )
})

Deno.test('sanitize extended key patterns', () => {
  assertEquals(
    sanitizeUrl('https://x.com/?key=secret&foo=bar'),
    'https://x.com/?key=***&foo=bar',
  )
  assertEquals(
    sanitizeUrl('https://x.com/?access_token=abc123&page=1'),
    'https://x.com/?access_token=***&page=1',
  )
  assertEquals(
    sanitizeUrl('https://x.com/?auth_token=tok&bar=1'),
    'https://x.com/?auth_token=***&bar=1',
  )
  assertEquals(
    sanitizeUrl('https://x.com/?secret=xyz&id=5'),
    'https://x.com/?secret=***&id=5',
  )
  assertEquals(
    sanitizeUrl('https://x.com/?password=12345&user=a'),
    'https://x.com/?password=***&user=a',
  )
})

Deno.test('sanitizeError masks sensitive query in Error.message', () => {
  const msg = sanitizeError(new Error('request to https://x.com/?api_key=secret failed'))
  assertEquals(msg, 'request to https://x.com/?api_key=*** failed')
})

Deno.test('sanitizeError handles non-Error values', () => {
  const msg = sanitizeError('token=abc123 was invalid')
  assertEquals(msg, 'token=*** was invalid')
})

Deno.test('sanitizeError handles plain strings without sensitive data', () => {
  const msg = sanitizeError('something broke')
  assertEquals(msg, 'something broke')
})
