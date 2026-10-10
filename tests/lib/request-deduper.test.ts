import { RequestDeduper } from '../../src/lib/request-deduper.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('RequestDeduper - deduplicates identical concurrent requests', async () => {
  const deduper = new RequestDeduper()
  let callCount = 0

  const mockRequest = async () => {
    callCount++
    await new Promise(resolve => setTimeout(resolve, 100))
    return new Response(`result-${callCount}`)
  }

  const url = 'https://example.com/api/test'

  // Start multiple concurrent requests
  const promises = Array(5)
    .fill(null)
    .map(() => deduper.run(url, mockRequest))

  const responses = await Promise.all(promises)
  const results = await Promise.all(responses.map(r => r.text()))

  // Should only call the function once
  assert.deepEqual(callCount, 1)

  // All results should be identical
  results.forEach(result => assert.deepEqual(result, 'result-1'))
})

test('RequestDeduper - handles different URLs separately', async () => {
  const deduper = new RequestDeduper()
  const callCounts: Record<string, number> = {}

  const mockRequest = async (url: string) => {
    callCounts[url] = (callCounts[url] || 0) + 1
    await new Promise(resolve => setTimeout(resolve, 50))
    return new Response(`result-${url}-${callCounts[url]}`)
  }

  const url1 = 'https://example.com/api/test1'
  const url2 = 'https://example.com/api/test2'

  const [response1, response2] = await Promise.all([
    deduper.run(url1, () => mockRequest(url1)),
    deduper.run(url2, () => mockRequest(url2)),
  ])

  const [result1, result2] = await Promise.all([response1.text(), response2.text()])

  assert.deepEqual(callCounts[url1], 1)
  assert.deepEqual(callCounts[url2], 1)
  assert.ok(result1.includes('result-https://example.com/api/test1'))
  assert.ok(result2.includes('result-https://example.com/api/test2'))
})

test('RequestDeduper - handles errors properly', async () => {
  const deduper = new RequestDeduper()
  const errorMessage = 'Request failed'

  const failingRequest = async () => {
    throw new Error(errorMessage)
  }

  const url = 'https://example.com/api/error'

  const response = await deduper.run(url, failingRequest)
  assert.deepEqual(response.status, 500)

  const result = await response.json()
  assert.deepEqual(result.error, 'Internal Server Error')
})

test('RequestDeduper - cleans up completed requests', async () => {
  const deduper = new RequestDeduper()

  const mockRequest = async () => {
    return new Response('success')
  }

  const url = 'https://example.com/api/cleanup'

  await deduper.run(url, mockRequest)

  // Wait a bit for cleanup
  await new Promise(resolve => setTimeout(resolve, 10))

  // Request should be cleaned up (implementation specific)
  // This is more of an integration test - the key is that it doesn't throw
  const response = await deduper.run(url, mockRequest)
  assert.deepEqual(await response.text(), 'success')
})
