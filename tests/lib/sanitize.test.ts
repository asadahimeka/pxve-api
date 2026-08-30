import { assertEquals } from '@std/assert'
import { sanitizeUrl } from '@lib/sanitize.ts'
Deno.test('sanitize api_key', () => {
  assertEquals(
    sanitizeUrl('https://saucenao.com/search.php?api_key=secret&url=https://a.com/x.jpg'),
    'https://saucenao.com/search.php?api_key=***&url=https://a.com/x.jpg',
  )
})
