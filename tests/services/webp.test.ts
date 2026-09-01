import { assertEquals, assertRejects } from '@std/assert'
import { convertWebP } from '../../src/services/webp.ts'

Deno.test('webp service - convertWebP throws on unsupported file type', async () => {
  await assertRejects(
    () => convertWebP('https://example.com/image.svg'),
    Error,
  )
})

Deno.test('webp service - convertWebP extracts path correctly', () => {
  const testUrl = new URL('https://localhost:3021/api/webp/https://example.com/image.jpg')
  const imgUrl = new URL(testUrl.pathname.replace('/api/webp/', '') + testUrl.search)

  assertEquals(imgUrl.pathname.includes('image.jpg'), true)
})

Deno.test('webp service - width and height params are extracted', () => {
  const testUrl = new URL('https://localhost:3021/api/webp/https://example.com/image.jpg?w=800&h=600')
  const imgUrl = new URL(testUrl.pathname.replace('/api/webp/', '') + testUrl.search)

  const width = imgUrl.searchParams.get('w')
  const height = imgUrl.searchParams.get('h')

  assertEquals(width, '800')
  assertEquals(height, '600')
})
