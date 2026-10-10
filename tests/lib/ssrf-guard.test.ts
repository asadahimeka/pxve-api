import { assertSafeUrl } from '#lib/ssrf-guard.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('block private ip', async () => {
  await assert.rejects(() => assertSafeUrl('http://192.168.1.1/foo'))
  await assert.rejects(() => assertSafeUrl('http://10.0.0.1/'))
  await assert.rejects(() => assertSafeUrl('http://169.254.169.254/latest/meta-data/'))
})

test('block ipv6 loopback and private', async () => {
  // ::1 loopback
  await assert.rejects(() => assertSafeUrl('http://[::1]/'))
  // :: (unspecified)
  await assert.rejects(() => assertSafeUrl('http://[::]/'))
  // fc00:: unique local
  await assert.rejects(() => assertSafeUrl('http://[fc00::1]/'))
  // fd12:3456:789a::1 unique local
  await assert.rejects(() => assertSafeUrl('http://[fd12:3456:789a::1]/'))
  // fe80:: link-local
  await assert.rejects(() => assertSafeUrl('http://[fe80::1]/'))
  // ::ffff:192.168.1.1 IPv4-mapped private
  await assert.rejects(() => assertSafeUrl('http://[::ffff:192.168.1.1]/'))
  // ::ffff:10.0.0.1 IPv4-mapped private
  await assert.rejects(() => assertSafeUrl('http://[::ffff:10.0.0.1]/'))
  // ::ffff:0:192.168.1.1 → normalized [::ffff:0:c0a8:101] (leading-zero hextet bypass)
  await assert.rejects(() => assertSafeUrl('http://[::ffff:0:192.168.1.1]/'))
  // ::ffff:0:0:192.168.1.1 → normalized [::ffff:0:0:c0a8:101] (two leading-zero hextets)
  await assert.rejects(() => assertSafeUrl('http://[::ffff:0:0:192.168.1.1]/'))
  // ::c0a8:101 — legacy IPv4-compatible form (= ::192.168.1.1)
  await assert.rejects(() => assertSafeUrl('http://[::c0a8:101]/'))
})

test('ipv6 error messages contain hostname', async () => {
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

test('allow public ipv6', async () => {
  // 2606:4700:: (Cloudflare) is public
  const u = await assertSafeUrl('http://[2606:4700::1]/img.jpg')
  assert.deepEqual(u.hostname, '[2606:4700::1]')
})

test('allow public', async () => {
  const u = await assertSafeUrl('https://i.pximg.net/img.jpg')
  assert.deepEqual(u.hostname, 'i.pximg.net')
})

test('block non-http protocol', async () => {
  await assert.rejects(() => assertSafeUrl('file:///etc/passwd'))
})
