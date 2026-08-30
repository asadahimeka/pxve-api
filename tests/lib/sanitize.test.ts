import { assertEquals } from '@std/assert'
import { sanitizeUrl } from '@lib/sanitize.ts'

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
