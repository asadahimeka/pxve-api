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

function deferred() {
  let release!: () => void
  const gate = new Promise<void>(r => (release = r))
  return { gate, release }
}

test('RequestDeduper - production shape: late joiner still gets full body', async () => {
  const deduper = new RequestDeduper()
  let callCount = 0
  const { gate, release } = deferred()
  const body = () =>
    new Response(
      new ReadableStream({
        async start(c) {
          c.enqueue(new TextEncoder().encode('img-bytes'))
          await new Promise(r => setTimeout(r, 5))
          c.close()
        },
      }),
    )

  const first = (async () => {
    const res = await deduper.run('https://example.com/pximg/x.jpg', async () => {
      callCount++
      await gate
      return body()
    })
    return await res.text()
  })()

  await new Promise(r => setTimeout(r, 10))
  const joiner = (async () => {
    const res = await deduper.run('https://example.com/pximg/x.jpg', async () => body())
    return await res.text()
  })()

  release()
  const [f, j] = await Promise.all([first, joiner])
  assert.deepEqual(callCount, 1)
  assert.deepEqual(f, 'img-bytes')
  assert.deepEqual(j, 'img-bytes')
})

test('RequestDeduper - oversize Content-Length falls back to independent fetch', async () => {
  const deduper = new RequestDeduper(16)
  let callCount = 0
  const { gate, release } = deferred()
  const full = '0123456789abcdef0123456789abcdef'
  const mk = () => {
    callCount++
    return new Response(full, { headers: { 'content-length': '32' } })
  }
  const key = 'https://example.com/pximg/big.jpg'

  const first = (async () => {
    const res = await deduper.run(key, async () => {
      await gate
      return mk()
    })
    return await res.text()
  })()

  await new Promise(r => setTimeout(r, 10))
  const joiner = (async () => {
    const res = await deduper.run(key, async () => mk())
    return await res.text()
  })()

  release()
  const [a, b] = await Promise.all([first, joiner])
  assert.deepEqual(a, full)
  assert.deepEqual(b, full)
  assert.deepEqual(callCount, 3)
})

test('RequestDeduper - oversize chunked body cancels mid-stream and refetches', async () => {
  const deduper = new RequestDeduper(16)
  let callCount = 0
  const { gate, release } = deferred()
  const mk = () => {
    callCount++
    return new Response(
      new ReadableStream({
        async start(c) {
          c.enqueue(new TextEncoder().encode('0123456789abcdef'))
          await new Promise(r => setTimeout(r, 5))
          c.enqueue(new TextEncoder().encode('0123456789abcdef'))
          c.close()
        },
      }),
    )
  }
  const key = 'https://example.com/pximg/chunked.jpg'

  const first = (async () => {
    const res = await deduper.run(key, async () => {
      await gate
      return mk()
    })
    return await res.text()
  })()

  await new Promise(r => setTimeout(r, 10))
  const joiner = (async () => {
    const res = await deduper.run(key, async () => mk())
    return await res.text()
  })()

  release()
  const [c, d] = await Promise.all([first, joiner])
  assert.deepEqual(c, '0123456789abcdef0123456789abcdef')
  assert.deepEqual(d, '0123456789abcdef0123456789abcdef')
  assert.deepEqual(callCount, 3)
})

test('RequestDeduper - body exactly at cap is buffered once', async () => {
  const deduper = new RequestDeduper(16)
  let callCount = 0
  const full = '0123456789abcdef'
  const mk = () => {
    callCount++
    return new Response(full, { headers: { 'content-length': '16' } })
  }
  const key = 'https://example.com/pximg/exact.jpg'
  const [a, b] = await Promise.all([
    deduper.run(key, async () => mk()).then(r => r.text()),
    deduper.run(key, async () => mk()).then(r => r.text()),
  ])
  assert.deepEqual(a, full)
  assert.deepEqual(b, full)
  assert.deepEqual(callCount, 1)
})

test('RequestDeduper - null body responses are shared as empty', async () => {
  const deduper = new RequestDeduper()
  let callCount = 0
  const key = 'https://example.com/api/nocontent'
  const { gate, release } = deferred()

  const first = (async () => {
    const res = await deduper.run(key, async () => {
      callCount++
      await gate
      return new Response(null, { status: 204 })
    })
    return { status: res.status, text: await res.text() }
  })()

  await new Promise(r => setTimeout(r, 10))
  const joiner = (async () => {
    const res = await deduper.run(key, async () => new Response(null, { status: 204 }))
    return { status: res.status, text: await res.text() }
  })()

  release()
  const [e, g] = await Promise.all([first, joiner])
  assert.deepEqual(callCount, 1)
  assert.deepEqual(e, { status: 204, text: '' })
  assert.deepEqual(g, { status: 204, text: '' })
})

test('RequestDeduper - fn() failure is shared as 500 JSON to late joiners', async () => {
  const deduper = new RequestDeduper()
  const key = 'https://example.com/api/shared-error'
  const { gate, release } = deferred()

  const first = (async () => {
    const res = await deduper.run(key, async () => {
      await gate
      throw new Error('boom')
    })
    return { status: res.status, json: await res.json() }
  })()

  await new Promise(r => setTimeout(r, 10))
  const joiner = (async () => {
    const res = await deduper.run(key, async () => {
      throw new Error('boom')
    })
    return { status: res.status, json: await res.json() }
  })()

  release()
  const [h, k] = await Promise.all([first, joiner])
  assert.deepEqual(h, { status: 500, json: { error: 'Internal Server Error' } })
  assert.deepEqual(k, { status: 500, json: { error: 'Internal Server Error' } })
})

test('RequestDeduper - refetch failure returns 500 JSON', async () => {
  const deduper = new RequestDeduper(16)
  let callCount = 0
  const res = await deduper.run('https://example.com/pximg/flaky.jpg', async () => {
    callCount++
    if (callCount === 1) {
      return new Response('0123456789abcdef0123456789abcdef', { headers: { 'content-length': '32' } })
    }
    throw new Error('upstream gone')
  })
  assert.deepEqual(callCount, 2)
  assert.deepEqual(res.status, 500)
  assert.deepEqual(await res.json(), { error: 'Internal Server Error' })
})

test('RequestDeduper - under-reported Content-Length still trips the cap mid-stream', async () => {
  const deduper = new RequestDeduper(16)
  let callCount = 0
  const { gate, release } = deferred()
  const full = '0123456789abcdef0123456789abcdef'
  const mk = () => {
    callCount++
    return new Response(full, { headers: { 'content-length': '8' } })
  }
  const key = 'https://example.com/pximg/lying.jpg'

  const first = (async () => {
    const res = await deduper.run(key, async () => {
      await gate
      return mk()
    })
    return await res.text()
  })()

  await new Promise(r => setTimeout(r, 10))
  const joiner = (async () => {
    const res = await deduper.run(key, async () => mk())
    return await res.text()
  })()

  release()
  const [a, b] = await Promise.all([first, joiner])
  assert.deepEqual(a, full)
  assert.deepEqual(b, full)
  assert.deepEqual(callCount, 3)
})
