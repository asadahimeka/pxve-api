import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile as fsReadFile, rename, unlink, writeFile as fsWriteFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface CacheEntryMeta {
  key: string
  status: number
  headers: Array<[string, string]>
  setCookie: string[]
  createdAt: number
  lastAccessedAt: number
  expiresAt: number | null
  size: number
}

export interface CacheStats {
  entries: number
  bytes: number
  expiredCount: number
  items: CacheEntryMeta[]
}

export interface HttpCacheStore {
  match(key: string): Promise<Response | null>
  put(key: string, res: Response, maxAgeMs?: number): Promise<void>
  delete(key: string): Promise<boolean>
  clear(): Promise<void>
  stats(): Promise<CacheStats>
  cleanup(): Promise<{ removedExpired: number; evicted: number }>
}

function fileBase(dir: string, key: string): string {
  return join(dir, createHash('sha256').update(key).digest('hex'))
}

function splitHeaders(res: Response): { headers: Array<[string, string]>; setCookie: string[] } {
  const headers: Array<[string, string]> = []
  for (const [k, v] of res.headers) {
    if (k.toLowerCase() === 'set-cookie') continue
    headers.push([k, v])
  }
  const getSetCookie = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  return { headers, setCookie: typeof getSetCookie === 'function' ? getSetCookie.call(res.headers) : [] }
}

function buildResponse(meta: CacheEntryMeta, body: Uint8Array): Response {
  const headers = new Headers(meta.headers)
  for (const sc of meta.setCookie) headers.append('set-cookie', sc)
  return new Response(body, { status: meta.status, headers })
}

async function writeAtomic(path: string, data: Uint8Array | string): Promise<void> {
  const tmp = `${path}.${randomUUID()}.tmp`
  await fsWriteFile(tmp, data)
  await rename(tmp, path)
}

async function readMeta(base: string): Promise<CacheEntryMeta | null> {
  try {
    return JSON.parse(await fsReadFile(`${base}.meta.json`, 'utf8')) as CacheEntryMeta
  } catch {
    return null
  }
}

async function removeEntry(base: string): Promise<boolean> {
  const [body, meta] = await Promise.all([
    unlink(`${base}.body`).then(() => true).catch(() => false),
    unlink(`${base}.meta.json`).then(() => true).catch(() => false),
  ])
  return body || meta
}

export function createHttpCacheStore(opts: {
  dir: string
  maxEntries: number
  maxSizeBytes?: number
  defaultMaxAgeMs?: number
}): HttpCacheStore {
  const { dir, maxEntries, maxSizeBytes, defaultMaxAgeMs } = opts

  async function listBases(): Promise<string[]> {
    let names: string[]
    try {
      names = await readdir(dir)
    } catch {
      return []
    }
    const hexes = new Set<string>()
    for (const n of names) {
      const m = /^([0-9a-f]{64})\.(body|meta\.json)$/.exec(n)
      if (m) hexes.add(m[1])
    }
    return [...hexes].map(h => join(dir, h))
  }

  async function readAllMetas(): Promise<Array<{ base: string; meta: CacheEntryMeta }>> {
    const out: Array<{ base: string; meta: CacheEntryMeta }> = []
    for (const base of await listBases()) {
      const meta = await readMeta(base)
      if (meta) out.push({ base, meta })
    }
    return out
  }

  async function enforceLimits(): Promise<number> {
    if (maxEntries <= 0) return 0
    const all = await readAllMetas()
    const now = Date.now()
    // Expired first, then oldest-accessed first.
    all.sort((a, b) => {
      const aExp = a.meta.expiresAt !== null && a.meta.expiresAt < now
      const bExp = b.meta.expiresAt !== null && b.meta.expiresAt < now
      if (aExp !== bExp) return aExp ? -1 : 1
      return a.meta.lastAccessedAt - b.meta.lastAccessedAt
    })
    let totalSize = all.reduce((s, e) => s + e.meta.size, 0)
    let evicted = 0
    for (const { base, meta } of all) {
      const overEntries = all.length - evicted > maxEntries
      const overSize = maxSizeBytes !== undefined && totalSize > maxSizeBytes
      if (!overEntries && !overSize) break
      totalSize -= meta.size
      evicted++
      await removeEntry(base)
    }
    return evicted
  }

  return {
    async match(key: string): Promise<Response | null> {
      const base = fileBase(dir, key)
      const meta = await readMeta(base)
      if (!meta) return null
      const now = Date.now()
      if (meta.expiresAt !== null && meta.expiresAt < now) {
        await removeEntry(base)
        return null
      }
      let body: Uint8Array
      try {
        body = await fsReadFile(`${base}.body`)
      } catch {
        await removeEntry(base)
        return null
      }
      // Touch access time (write amplification accepted for LRU accuracy).
      meta.lastAccessedAt = now
      await writeAtomic(`${base}.meta.json`, JSON.stringify(meta)).catch(() => {})
      return buildResponse(meta, body)
    },

    async put(key: string, res: Response, maxAgeMs?: number): Promise<void> {
      await mkdir(dir, { recursive: true })
      const base = fileBase(dir, key)
      const body = new Uint8Array(await res.clone().arrayBuffer())
      const { headers, setCookie } = splitHeaders(res)
      const now = Date.now()
      const ttl = maxAgeMs ?? defaultMaxAgeMs
      const meta: CacheEntryMeta = {
        key,
        status: res.status,
        headers,
        setCookie,
        createdAt: now,
        lastAccessedAt: now,
        expiresAt: ttl !== undefined ? now + ttl : null,
        size: body.length,
      }
      await writeAtomic(`${base}.body`, body)
      await writeAtomic(`${base}.meta.json`, JSON.stringify(meta))
      await enforceLimits()
    },

    async delete(key: string): Promise<boolean> {
      return removeEntry(fileBase(dir, key))
    },

    async clear(): Promise<void> {
      for (const base of await listBases()) {
        await removeEntry(base)
      }
    },

    async stats(): Promise<CacheStats> {
      const now = Date.now()
      const items = (await readAllMetas()).map(e => e.meta)
      let bytes = 0
      let expiredCount = 0
      for (const m of items) {
        bytes += m.size
        if (m.expiresAt !== null && m.expiresAt < now) expiredCount++
      }
      return { entries: items.length, bytes, expiredCount, items }
    },

    async cleanup(): Promise<{ removedExpired: number; evicted: number }> {
      const now = Date.now()
      let removedExpired = 0
      for (const { base, meta } of await readAllMetas()) {
        if (meta.expiresAt !== null && meta.expiresAt < now) {
          await removeEntry(base)
          removedExpired++
        }
      }
      const evicted = await enforceLimits()
      return { removedExpired, evicted }
    },
  }
}
