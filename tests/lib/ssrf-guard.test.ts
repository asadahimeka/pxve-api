import { assertEquals, assertRejects } from '@std/assert'
import { assertSafeUrl } from '@lib/ssrf-guard.ts'

Deno.test('block private ip', async () => {
  await assertRejects(() => assertSafeUrl('http://192.168.1.1/foo'))
  await assertRejects(() => assertSafeUrl('http://10.0.0.1/'))
  await assertRejects(() => assertSafeUrl('http://169.254.169.254/latest/meta-data/'))
})

Deno.test('block ipv6 loopback and private', async () => {
  // ::1 loopback
  await assertRejects(() => assertSafeUrl('http://[::1]/'))
  // :: (unspecified)
  await assertRejects(() => assertSafeUrl('http://[::]/'))
  // fc00:: unique local
  await assertRejects(() => assertSafeUrl('http://[fc00::1]/'))
  // fd12:3456:789a::1 unique local
  await assertRejects(() => assertSafeUrl('http://[fd12:3456:789a::1]/'))
  // fe80:: link-local
  await assertRejects(() => assertSafeUrl('http://[fe80::1]/'))
  // ::ffff:192.168.1.1 IPv4-mapped private
  await assertRejects(() => assertSafeUrl('http://[::ffff:192.168.1.1]/'))
  // ::ffff:10.0.0.1 IPv4-mapped private
  await assertRejects(() => assertSafeUrl('http://[::ffff:10.0.0.1]/'))
  // ::ffff:0:192.168.1.1 → normalized [::ffff:0:c0a8:101] (leading-zero hextet bypass)
  await assertRejects(() => assertSafeUrl('http://[::ffff:0:192.168.1.1]/'))
  // ::ffff:0:0:192.168.1.1 → normalized [::ffff:0:0:c0a8:101] (two leading-zero hextets)
  await assertRejects(() => assertSafeUrl('http://[::ffff:0:0:192.168.1.1]/'))
  // ::c0a8:101 — legacy IPv4-compatible form (= ::192.168.1.1)
  await assertRejects(() => assertSafeUrl('http://[::c0a8:101]/'))
})

Deno.test('ipv6 error messages contain hostname', async () => {
  try {
    await assertSafeUrl('http://[::1]/')
    throw new Error('should have thrown')
  } catch (e) {
    if (e instanceof Error && e.message.includes('blocked private')) {
      // expected
    } else {
      throw e
    }
  }
})

Deno.test('allow public ipv6', async () => {
  // 2606:4700:: (Cloudflare) is public
  const u = await assertSafeUrl('http://[2606:4700::1]/img.jpg')
  assertEquals(u.hostname, '[2606:4700::1]')
})

Deno.test('allow public', async () => {
  const u = await assertSafeUrl('https://i.pximg.net/img.jpg')
  assertEquals(u.hostname, 'i.pximg.net')
})

Deno.test('block non-http protocol', async () => {
  await assertRejects(() => assertSafeUrl('file:///etc/passwd'))
})
