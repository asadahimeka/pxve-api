import { getNumberEnv } from './runtime.ts'

import { sanitizeError, sanitizeUrl } from '#lib/sanitize.ts'

const DEDUPER_MAX = getNumberEnv('DEDUPER_MAX', 500)
const DEDUP_BODY_MAX = getNumberEnv('DEDUP_BODY_MAX', 5 * 1024 * 1024)

type Buffered = { init: ResponseInit; buf: Uint8Array }

function internalError(key: string, err: any): Buffered {
  console.error('[ERROR]:', new Date().toLocaleString('zh'), sanitizeUrl(key), sanitizeError(err))
  return {
    init: { status: 500, headers: { 'content-type': 'application/json' } },
    buf: new TextEncoder().encode(JSON.stringify({ error: 'Internal Server Error' })),
  }
}

async function readCapped(res: Response, cap: number): Promise<Uint8Array | null> {
  const cl = res.headers.get('content-length')
  const n = cl === null ? NaN : Number(cl)
  if (Number.isFinite(n) && n > cap) {
    await res.body?.cancel().catch(() => {})
    return null
  }
  const reader = res.body?.getReader()
  if (!reader) return new Uint8Array(0)
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > cap) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const buf = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    buf.set(chunk, offset)
    offset += chunk.byteLength
  }
  return buf
}

export class RequestDeduper {
  map: Map<string, Promise<Buffered | null>>

  private maxBodyBytes: number

  constructor(maxBodyBytes: number = DEDUP_BODY_MAX) {
    this.maxBodyBytes = maxBodyBytes
    this.map = new Map()
  }

  async run(key: string, fn: (...args: any[]) => Response | Promise<Response>): Promise<Response> {
    let promise = this.map.get(key)
    if (!promise) {
      if (this.map.size >= DEDUPER_MAX) {
        throw new Error('Deduper queue full')
      }
      promise = (async (): Promise<Buffered | null> => {
        try {
          const res = await fn()
          const buf = await readCapped(res, this.maxBodyBytes)
          if (buf === null) return null
          return {
            init: { status: res.status, statusText: res.statusText, headers: res.headers },
            buf,
          }
        } catch (err: any) {
          return internalError(key, err)
        } finally {
          this.map.delete(key)
        }
      })()
      this.map.set(key, promise)
    }
    const data = await promise
    if (data === null) {
      try {
        return await fn()
      } catch (err: any) {
        const fb = internalError(key, err)
        return new Response(fb.buf.slice(), fb.init)
      }
    }
    return new Response(data.buf.byteLength ? data.buf.slice() : null, data.init)
  }
}
