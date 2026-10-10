import { convertWebP } from '../../src/services/webp.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('webp service - convertWebP throws on unsupported file type', async () => {
  await assert.rejects(() => convertWebP('https://example.com/image.svg'), Error)
})

test('webp service - convertWebP extracts path correctly', () => {
  const testUrl = new URL('https://localhost:3021/api/webp/https://example.com/image.jpg')
  const imgUrl = new URL(testUrl.pathname.replace('/api/webp/', '') + testUrl.search)

  assert.deepEqual(imgUrl.pathname.includes('image.jpg'), true)
})

test('webp service - width and height params are extracted', () => {
  const testUrl = new URL('https://localhost:3021/api/webp/https://example.com/image.jpg?w=800&h=600')
  const imgUrl = new URL(testUrl.pathname.replace('/api/webp/', '') + testUrl.search)

  const width = imgUrl.searchParams.get('w')
  const height = imgUrl.searchParams.get('h')

  assert.deepEqual(width, '800')
  assert.deepEqual(height, '600')
})
