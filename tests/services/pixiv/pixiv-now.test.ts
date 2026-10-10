import { getSessionUserMeta, objectToQueryString } from '../../../src/services/pixiv/pixiv-now.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('pixiv-now - objectToQueryString handles empty params', () => {
  const result = objectToQueryString(undefined)
  assert.deepEqual(result === '' || result === '?', true)
})

test('pixiv-now - objectToQueryString handles query params', () => {
  const result = objectToQueryString({ id: '123', type: 'illustration' })
  assert.deepEqual(result.includes('id=123'), true)
  assert.deepEqual(result.includes('type=illustration'), true)
})

test('pixiv-now - objectToQueryString handles array params', () => {
  const result = objectToQueryString({ tags: ['tag1', 'tag2'] })
  assert.deepEqual(result.includes('tags=tag1'), true)
  assert.deepEqual(result.includes('tags=tag2'), true)
})

test('pixiv-now - getSessionUserMeta parses legacy global meta', () => {
  const html = `
    <html>
      <head>
        <meta name="global-data" content='{"userData":{"id":123,"name":"test"},"token":"abc123"}'>
      </head>
    </html>
  `

  const result = getSessionUserMeta(html)
  assert.deepEqual(result.userData.id, 123)
  assert.deepEqual(result.userData.name, 'test')
  assert.deepEqual(result.token, 'abc123')
})

test('pixiv-now - getSessionUserMeta throws on invalid meta', () => {
  const html = '<html><head></head><body>no meta</body></html>'

  let threw = false
  try {
    getSessionUserMeta(html)
  } catch (e) {
    threw = true
    assert.deepEqual((e as Error).message.includes('未知的'), true)
  }
  assert.deepEqual(threw, true)
})
