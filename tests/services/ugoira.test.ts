import { assertEquals, assertRejects } from '@std/assert'
import { convertUgoira, ugoiraExtRegex, ugoiraExts } from '../../src/services/ugoira.ts'
import { isSafeZipEntry } from '../../src/services/worker/ugoira-worker.ts'

Deno.test('ugoiraExtRegex validates correct formats', () => {
  // Valid formats
  assertEquals(ugoiraExtRegex.test('123456.mp4'), true)
  assertEquals(ugoiraExtRegex.test('123456.gif'), true)
  assertEquals(ugoiraExtRegex.test('123456.webp'), true)
  assertEquals(ugoiraExtRegex.test('123456.webm'), true)
  assertEquals(ugoiraExtRegex.test('123456.avif'), true)
  assertEquals(ugoiraExtRegex.test('123456.apng'), true)

  // Invalid formats
  assertEquals(ugoiraExtRegex.test('123456.jpg'), false)
  assertEquals(ugoiraExtRegex.test('123456.png'), false)
  assertEquals(ugoiraExtRegex.test('notanumber.mp4'), false)
  assertEquals(ugoiraExtRegex.test('123456'), false)
})

Deno.test('ugoira service - ugoiraExts contains all supported extensions', () => {
  const expected = ['mp4', 'gif', 'apng', 'webp', 'webm', 'avif']
  assertEquals(ugoiraExts, expected)
})

Deno.test('ugoira service - convertUgoira throws on invalid ID', async () => {
  await assertRejects(
    () => convertUgoira('invalid.mp4'),
    Error,
    'Invalid ugoira extension'
  )
})

Deno.test('ugoira service - convertUgoira throws on missing ID', async () => {
  await assertRejects(
    () => convertUgoira(''),
    Error,
    'Invalid ugoira extension'
  )
})

Deno.test('isSafeZipEntry blocks path traversal', () => {
  assertEquals(isSafeZipEntry('../etc/passwd'), false)
  assertEquals(isSafeZipEntry('/absolute/path.jpg'), false)
  assertEquals(isSafeZipEntry('images\\1.jpg'), false)
  assertEquals(isSafeZipEntry('C:\\windows\\system32'), false)
  assertEquals(isSafeZipEntry('images/1.jpg'), true)
  assertEquals(isSafeZipEntry('frames/000123.jpg'), true)
  assertEquals(isSafeZipEntry('simple.png'), true)
})
