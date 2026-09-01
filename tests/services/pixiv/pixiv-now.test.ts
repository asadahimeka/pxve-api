import { assertEquals, assertExists, assertRejects } from '@std/assert'
import { getSessionUserMeta, objectToQueryString } from '../../../src/services/pixiv/pixiv-now.ts'

Deno.test('pixiv-now - objectToQueryString handles empty params', () => {
  const result = objectToQueryString(undefined)
  assertEquals(result === '' || result === '?', true)
})

Deno.test('pixiv-now - objectToQueryString handles query params', () => {
  const result = objectToQueryString({ id: '123', type: 'illustration' })
  assertEquals(result.includes('id=123'), true)
  assertEquals(result.includes('type=illustration'), true)
})

Deno.test('pixiv-now - objectToQueryString handles array params', () => {
  const result = objectToQueryString({ tags: ['tag1', 'tag2'] })
  assertEquals(result.includes('tags=tag1'), true)
  assertEquals(result.includes('tags=tag2'), true)
})

Deno.test('pixiv-now - getSessionUserMeta parses legacy global meta', () => {
  const html = `
    <html>
      <head>
        <meta name="global-data" content='{"userData":{"id":123,"name":"test"},"token":"abc123"}'>
      </head>
    </html>
  `

  const result = getSessionUserMeta(html)
  assertEquals(result.userData.id, 123)
  assertEquals(result.userData.name, 'test')
  assertEquals(result.token, 'abc123')
})

Deno.test('pixiv-now - getSessionUserMeta throws on invalid meta', () => {
  const html = '<html><head></head><body>no meta</body></html>'

  let threw = false
  try {
    getSessionUserMeta(html)
  } catch (e) {
    threw = true
    assertEquals((e as Error).message.includes('未知的'), true)
  }
  assertEquals(threw, true)
})
