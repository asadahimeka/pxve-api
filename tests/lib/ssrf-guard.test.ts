import { assertEquals, assertRejects } from '@std/assert'
import { assertSafeUrl } from '@lib/ssrf-guard.ts'

Deno.test('block private ip', async () => {
  await assertRejects(() => assertSafeUrl('http://192.168.1.1/foo'))
  await assertRejects(() => assertSafeUrl('http://10.0.0.1/'))
  await assertRejects(() => assertSafeUrl('http://169.254.169.254/latest/meta-data/'))
})
Deno.test('allow public', async () => {
  const u = await assertSafeUrl('https://i.pximg.net/img.jpg')
  assertEquals(u.hostname, 'i.pximg.net')
})
Deno.test('block non-http protocol', async () => {
  await assertRejects(() => assertSafeUrl('file:///etc/passwd'))
})
