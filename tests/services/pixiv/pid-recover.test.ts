import { recoverPidImage } from '../../../src/services/pixiv/pid-recover.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('pid-recover service - recoverPidImage returns null when no results', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (): Promise<Response> => {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const result = await recoverPidImage('99999999')
    assert.deepEqual(result, null)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('pid-recover service - recovers image from danbooru', async () => {
  const originalFetch = globalThis.fetch
  let callCount = 0

  globalThis.fetch = async (): Promise<Response> => {
    callCount++
    const mockData = [
      {
        source: 'https://i.pixiv.net/img-original/img/2024/01/01/00/00/00/12345678_p0.jpg',
        tag_string: 'tag1 tag2',
        created_at: '2024-01-01',
        file_url: 'https://i.pixiv.net/img-original/img/2024/01/01/00/00/00/12345678_p0.jpg',
        media_asset: {
          variants: [{ url: 'https://i.pixiv.net/img-original/img/2024/01/01/00/00/00/12345678_p0.jpg' }],
        },
      },
    ]

    return new Response(JSON.stringify(mockData), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const result = await recoverPidImage('12345678')
    assert.ok(result !== null && result !== undefined)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('pid-recover service - queries multiple sources', async () => {
  const originalFetch = globalThis.fetch
  let callCount = 0

  globalThis.fetch = async (): Promise<Response> => {
    callCount++
    if (callCount === 1) {
      return new Response(JSON.stringify([]), { status: 200 })
    }
    const mockData = [
      {
        source: 'https://i.pixiv.net/img-original/img/2024/01/01/00/00/00/12345678_p0.jpg',
        tag_string: 'tag1 tag2',
        created_at: '2024-01-01',
        file_url: 'https://i.pixiv.net/img-original/img/2024/01/01/00/00/00/12345678_p0.jpg',
        media_asset: {
          variants: [{ url: 'https://i.pixiv.net/img-original/img/2024/01/01/00/00/00/12345678_p0.jpg' }],
        },
      },
    ]
    return new Response(JSON.stringify(mockData), { status: 200 })
  }

  try {
    const result = await recoverPidImage('12345678')
  } finally {
    globalThis.fetch = originalFetch
  }
})
