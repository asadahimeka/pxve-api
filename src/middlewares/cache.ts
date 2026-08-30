import type { Context, MiddlewareHandler } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import { sanitizeUrl } from '@lib/sanitize.ts'

/**
 * status codes that can be cached by default.
 */
const defaultCacheableStatusCodes: ReadonlyArray<StatusCode> = [200]
const shouldSkipCache = (res: Response) => {
  // Don't cache for Vary: *
  // https://www.rfc-editor.org/rfc/rfc9111#section-4.1
  // Also note that some runtimes throw a TypeError for it.
  const vary = res.headers.get('Vary')
  if (vary && vary.includes('*')) {
    return true
  }

  const cacheControl = res.headers.get('Cache-Control')
  if (cacheControl && /(?:^|,\s*)(?:private|no-(?:store|cache))(?:\s*(?:=|,|$))/i.test(cacheControl)) {
    return true
  }

  if (res.headers.has('Set-Cookie')) {
    return true
  }

  return false
}

/**
 * Cache metadata for tracking expiration and access times
 */
interface CacheMetadata {
  createdAt: number
  lastAccessedAt: number
  expiresAt: number | null
  key: string
}

/**
 * Parse max-age from Cache-Control header
 */
const parseMaxAge = (cacheControl: string | undefined): number | null => {
  if (!cacheControl) return null
  const match = cacheControl.match(/max-age=(\d+)/i)
  return match ? parseInt(match[1], 10) * 1000 : null
}

/**
 * Get metadata cache key for a given cache key
 */
const getMetadataKey = (key: string): string => {
  return `${key}&__metadata__`
}

const cacheKeysKey = 'http://__metadata__.cache.keys'
const getMetadataCacheKeys = (keys: string[] | null) => keys?.map(getMetadataKey) || []
const getCacheKeys = async (metadataCache: Cache) => {
  const match = await metadataCache.match(cacheKeysKey)
  if (!match) return null
  const keys = (await match.json()) as string[]
  return [...new Set(keys)]
}
const setCacheKey = async (metadataCache: Cache, key: string, { isDelete = false } = {}) => {
  let keys = await getCacheKeys(metadataCache)
  if (!keys) keys = []
  if (isDelete) {
    keys = keys.filter(e => e != key)
  } else {
    keys.push(key)
  }
  await metadataCache.put(
    cacheKeysKey,
    new Response(JSON.stringify(keys), {
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

/**
 * Clean expired entries from cache
 */
const cleanExpiredEntries = async (cache: Cache, metadataCache: Cache, now: number = Date.now()): Promise<void> => {
  console.log('[cache-middleware]: clean expired entries')
  try {
    const metadataKeys = getMetadataCacheKeys(await getCacheKeys(metadataCache))
    const expiredKeys: string[] = []
    for (const request of metadataKeys) {
      const metadataResponse = await metadataCache.match(request)
      if (!metadataResponse) continue
      const metadata = (await metadataResponse.json()) as CacheMetadata

      // Check if expired
      if (metadata.expiresAt && metadata.expiresAt < now) {
        expiredKeys.push(metadata.key)
      }
    }
    // Delete expired entries from both caches
    await Promise.all(
      expiredKeys.map(async key => {
        const metadataKey = getMetadataKey(key)
        await cache.delete(key)
        await metadataCache.delete(metadataKey)
        await setCacheKey(metadataCache, key, { isDelete: true })
      })
    )
  } catch (error) {
    console.error('Error cleaning expired cache entries:', error)
  }
}

/**
 * Enforce cache size limit by removing least recently used entries
 */
const enforceCacheSizeLimit = async (cache: Cache, metadataCache: Cache, maxSizeBytes: number): Promise<void> => {
  console.log('[cache-middleware]: enforce cache size limit (LRU)')
  try {
    const metadataKeys = getMetadataCacheKeys(await getCacheKeys(metadataCache))
    if (metadataKeys.length === 0) return
    // Collect all metadata with sizes
    const entries: Array<{ metadata: CacheMetadata; size: number }> = []
    for (const request of metadataKeys) {
      const metadataResponse = await metadataCache.match(request)
      if (!metadataResponse) continue
      const metadata = (await metadataResponse.json()) as CacheMetadata
      const cachedResponse = await cache.match(metadata.key)

      if (cachedResponse) {
        // Estimate response size (note: exact size may vary by runtime)
        const clonedResponse = cachedResponse.clone()
        const blob = await clonedResponse.blob()
        const size = blob.size
        entries.push({ metadata, size })
      }
    }
    // Sort by lastAccessedAt (oldest first - LRU)
    entries.sort((a, b) => a.metadata.lastAccessedAt - b.metadata.lastAccessedAt)
    // Remove entries until under limit
    let totalSize = entries.reduce((sum, entry) => sum + entry.size, 0)
    const entriesToDelete: string[] = []
    for (const entry of entries) {
      if (totalSize <= maxSizeBytes) break
      totalSize -= entry.size
      entriesToDelete.push(entry.metadata.key)
    }
    // Delete entries
    await Promise.all(
      entriesToDelete.map(async key => {
        const metadataKey = getMetadataKey(key)
        await cache.delete(key)
        await metadataCache.delete(metadataKey)
        await setCacheKey(metadataCache, key, { isDelete: true })
      })
    )
  } catch (error) {
    console.error('Error enforcing cache size limit:', error)
  }
}

/**
 * Background task to periodically clean the cache
 */
const startBackgroundCleanup = (
  cacheName: string,
  options: {
    maxAge?: number
    maxSizeBytes?: number
    cleanupInterval?: number
  }
): (() => void) => {
  const { maxAge, maxSizeBytes, cleanupInterval = 5 * 60 * 1000 } = options
  if (!maxAge && !maxSizeBytes) {
    return () => {} // No cleanup needed
  }
  const timerId = setInterval(async () => {
    try {
      const cache = await caches.open(cacheName)
      const metadataCache = await caches.open(`${cacheName}:metadata`)
      if (maxAge) {
        await cleanExpiredEntries(cache, metadataCache)
      }
      if (maxSizeBytes) {
        await enforceCacheSizeLimit(cache, metadataCache, maxSizeBytes)
      }
    } catch (error) {
      console.error('Error in background cleanup:', error)
    }
  }, cleanupInterval)
  // Return cleanup function
  return () => clearInterval(timerId)
}

/**
 * Cache Middleware for Hono.
 *
 * @see {@link https://hono.dev/docs/middleware/builtin/cache}
 *
 * @param {Object} options - The options for the cache middleware.
 * @param {string | Function} options.cacheName - The name of the cache. Can be used to store multiple caches with different identifiers.
 * @param {string} [options.cacheControl] - A string of directives for the `Cache-Control` header.
 * @param {string | string[]} [options.vary] - Sets the `Vary` header in the response. If the original response header already contains a `Vary` header, the values are merged, removing any duplicates.
 * @param {Function} [options.keyGenerator] - Generates keys for every request in the `cacheName` store. This can be used to cache data based on request parameters or context parameters.
 * @param {number[]} [options.cacheableStatusCodes=[200]] - An array of status codes that can be cached.
 * @param {number} [options.maxAge] - Maximum age of cache entries in milliseconds. If not specified, uses max-age from Cache-Control header or never expires.
 * @param {number} [options.maxSizeBytes] - Maximum size of cache in bytes. Uses LRU eviction when limit is exceeded.
 * @param {number} [options.cleanupInterval=300000] - Interval in milliseconds for background cleanup. Default is 5 minutes.
 * @param {Function} [options.shouldBypassCache] - Function to determine if cache should be bypassed for a specific request. Receives context as parameter.
 * @returns {MiddlewareHandler} The middleware handler function.
 * @throws {Error} If the `vary` option includes "*".
 *
 * @example
 * ```ts
 * app.get(
 *   '*',
 *   cache({
 *     cacheName: 'my-app',
 *     cacheControl: 'max-age=3600',
 *     maxAge: 3600000, // 1 hour
 *     maxSizeBytes: 50 * 1024 * 1024, // 50MB
 *     cleanupInterval: 600000, // 10 minutes
 *   })
 * )
 * ```
 *
 * @example
 * Force update a specific route:
 * ```ts
 * app.get(
 *   '/api/data',
 *   cache({
 *     cacheName: 'api-cache',
 *     cacheControl: 'max-age=3600',
 *   }),
 *   async (c) => {
 *     // Force update if ?refresh=true is present
 *     const bypassCache = c.req.query('refresh') === 'true'
 *     c.set('bypassCache', bypassCache)
 *
 *     return fetchData()
 *   }
 * )
 * ```
 */
export const cache = (options: {
  cacheName: string | ((c: Context) => Promise<string> | string)
  cacheControl?: string
  vary?: string | string[]
  keyGenerator?: (c: Context) => Promise<string> | string
  cacheableStatusCodes?: StatusCode[]
  maxAge?: number
  maxSizeBytes?: number
  maxEntries?: number
  cleanupInterval?: number
  shouldBypassCache?: (c: Context) => boolean | Promise<boolean>
}): MiddlewareHandler => {
  if (!globalThis.caches) {
    console.log('Cache Middleware is not enabled because caches is not defined.')
    return async (_c, next) => await next()
  }

  const { maxAge, maxSizeBytes, maxEntries, cleanupInterval = 5 * 60 * 1000 } = options

  const cacheControlDirectives = options.cacheControl?.split(',').map(directive => directive.toLowerCase())
  const varyDirectives = Array.isArray(options.vary)
    ? options.vary
    : options.vary?.split(',').map(directive => directive.trim())
  // RFC 7231 Section 7.1.4 specifies that "*" is not allowed in Vary header.
  if (options.vary?.includes('*')) {
    throw new Error('Middleware vary configuration cannot include "*", as it disallows effective caching.')
  }

  const cacheableStatusCodes = new Set<number>(options.cacheableStatusCodes ?? defaultCacheableStatusCodes)

  const addHeader = (c: Context) => {
    if (cacheControlDirectives) {
      const existingDirectives =
        c.res.headers
          .get('Cache-Control')
          ?.split(',')
          .map(d => d.trim().split('=', 1)[0]) ?? []

      for (const directive of cacheControlDirectives) {
        let [name, value] = directive.trim().split('=', 2)
        name = name.toLowerCase()
        if (!existingDirectives.includes(name)) {
          c.header('Cache-Control', `${name}${value ? `=${value}` : ''}`, { append: true })
        }
      }
    }

    if (varyDirectives) {
      const existingDirectives =
        c.res.headers
          .get('Vary')
          ?.split(',')
          .map(d => d.trim()) ?? []
      const vary = Array.from(
        new Set([...existingDirectives, ...varyDirectives].map(directive => directive.toLowerCase()))
      ).sort()
      if (vary.includes('*')) {
        c.header('Vary', '*')
      } else {
        c.header('Vary', vary.join(', '))
      }
    }
  }

  // Map to track cleanup timers for dynamic cache names
  const cleanupTimers = new Map<string, () => void>()

  return async function cache(c, next) {
    let key = c.req.url
    if (options.keyGenerator) {
      key = await options.keyGenerator(c)
    }
    // Sanitize sensitive query params and mask auth header presence
    key = sanitizeUrl(key)
    const hasAuth = Boolean(c.req.header('authorization') || c.req.header('x-auth'))
    key = `${key}&auth=${hasAuth ? '1' : '0'}`

    const cacheName = typeof options.cacheName === 'function' ? await options.cacheName(c) : options.cacheName
    const cache = await caches.open(cacheName)
    const metadataCache = await caches.open(`${cacheName}:metadata`)
    const metadataKey = getMetadataKey(key)

    // Start cleanup timer for this cache name if not already started
    if ((maxAge || maxSizeBytes) && !cleanupTimers.has(cacheName)) {
      const stopTimer = startBackgroundCleanup(cacheName, {
        maxAge,
        maxSizeBytes,
        cleanupInterval,
      })
      cleanupTimers.set(cacheName, stopTimer)
    }

    // Check if cache should be bypassed
    let shouldBypass = false
    if (options.shouldBypassCache) {
      shouldBypass = await options.shouldBypassCache(c)
    } else {
      shouldBypass = Boolean(
        c.req.header('authorization') || c.req.header('x-auth') || c.req.header('cookie')?.includes('PHPSESSID')
      )
    }

    const now = Date.now()
    const response = await cache.match(key)
    let cachedMetadata: CacheMetadata | null = null
    if (response) {
      // Get metadata
      const metadataResponse = await metadataCache.match(metadataKey)
      if (metadataResponse) {
        cachedMetadata = (await metadataResponse.json()) as CacheMetadata
      }

      // Check if cache is expired
      let isExpired = false
      if (cachedMetadata?.expiresAt && cachedMetadata.expiresAt < now) {
        isExpired = true
      }

      // Return cached response if not expired or not forcing update
      if (!isExpired && !shouldBypass) {
        c.header('X-Cache', 'HIT')

        // Update metadata access time
        if (cachedMetadata) {
          cachedMetadata.lastAccessedAt = now
          await metadataCache.put(
            metadataKey,
            new Response(JSON.stringify(cachedMetadata), {
              headers: { 'Content-Type': 'application/json' },
            })
          )
        }
        return new Response(response.body, response)
      }

      // Delete expired or bypassed entry
      if (isExpired || shouldBypass) {
        await cache.delete(key)
        await metadataCache.delete(metadataKey)
        await setCacheKey(metadataCache, key, { isDelete: true })
      }
    }

    // Fetch fresh response
    await next()

    if (!cacheableStatusCodes.has(c.res.status) || c.res.headers.get('Cache-Control')?.includes('no-store')) {
      c.header('X-Cache', 'BYPASS')
      return
    }

    addHeader(c)

    if (shouldSkipCache(c.res) || c.get('bypassCache') === true) {
      c.header('X-Cache', 'BYPASS')
      return
    }

    c.header('X-Cache', shouldBypass ? 'BYPASS' : response ? 'EXPIRED' : 'MISS')

    const res = c.res.clone()

    // Calculate expiration
    let expiresAt: number | null = null
    const headerMaxAge = parseMaxAge(c.res.headers.get('Cache-Control') || undefined)
    if (headerMaxAge) {
      expiresAt = now + headerMaxAge
    } else if (maxAge) {
      expiresAt = now + maxAge
    }

    // Enforce maxEntries limit before storing
    if (maxEntries) {
      const currentKeys = await getCacheKeys(metadataCache)
      if (currentKeys && currentKeys.length >= maxEntries) {
        // Evict oldest entry by lastAccessedAt
        const entries: Array<{ key: string; lastAccessedAt: number }> = []
        for (const k of currentKeys) {
          const metaResp = await metadataCache.match(getMetadataKey(k))
          if (metaResp) {
            const meta = (await metaResp.json()) as CacheMetadata
            entries.push({ key: meta.key, lastAccessedAt: meta.lastAccessedAt })
          }
        }
        entries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)
        if (entries.length > 0) {
          const oldest = entries[0]
          await cache.delete(oldest.key)
          await metadataCache.delete(getMetadataKey(oldest.key))
          await setCacheKey(metadataCache, oldest.key, { isDelete: true })
        }
      }
    }

    // Store metadata
    const metadata: CacheMetadata = {
      createdAt: now,
      lastAccessedAt: now,
      expiresAt,
      key,
    }

    await cache.put(key, res)
    await metadataCache.put(
      metadataKey,
      new Response(JSON.stringify(metadata), {
        headers: { 'Content-Type': 'application/json' },
      })
    )
    await setCacheKey(metadataCache, key)
  }
}

/**
 * Manually clear all cache entries for a specific cache name
 */
export const clearCache = async (cacheName: string): Promise<void> => {
  console.log(`[cache-middleware]: clear cache "${cacheName}" `)
  try {
    await caches.delete(cacheName)
    await caches.delete(`${cacheName}:metadata`)
  } catch (error) {
    console.error(`Error clearing cache ${cacheName}:`, error)
    throw error
  }
}

/**
 * Manually delete a specific cache entry
 */
export const deleteCacheEntry = async (cacheName: string, key: string): Promise<boolean> => {
  console.log(`[cache-middleware]: delete cache entry "${key}" of "${cacheName}" `)
  try {
    const cache = await caches.open(cacheName)
    const metadataCache = await caches.open(`${cacheName}:metadata`)

    const metadataKey = getMetadataKey(key)
    const [deletedFromCache, deletedFromMetadata] = await Promise.all([
      cache.delete(key),
      metadataCache.delete(metadataKey),
      setCacheKey(metadataCache, key, { isDelete: true }),
    ])

    return deletedFromCache || deletedFromMetadata
  } catch (error) {
    console.error(`Error deleting cache entry ${key}:`, error)
    return false
  }
}

/**
 * Get cache statistics
 */
export const getCacheStats = async (
  cacheName: string
): Promise<{
  count: number
  totalSize: number
  expiredCount: number
  entries: Array<{ key: string; createdAt: number; lastAccessedAt: number; expiresAt: number | null; size: number }>
}> => {
  try {
    const cache = await caches.open(cacheName)
    const metadataCache = await caches.open(`${cacheName}:metadata`)
    const entries: Array<{
      key: string
      createdAt: number
      lastAccessedAt: number
      expiresAt: number | null
      size: number
    }> = []
    const metadataKeys = getMetadataCacheKeys(await getCacheKeys(metadataCache))
    console.log('metadataKeys: ', metadataKeys)
    const now = Date.now()
    let expiredCount = 0
    let totalSize = 0
    for (const request of metadataKeys) {
      const metadataResponse = await metadataCache.match(request)
      if (!metadataResponse) continue
      const metadata = (await metadataResponse.json()) as CacheMetadata
      console.log('metadata: ', metadata)
      const cachedResponse = await cache.match(metadata.key)

      if (cachedResponse) {
        const clonedResponse = cachedResponse.clone()
        const blob = await clonedResponse.blob()
        const size = blob.size
        console.log('size: ', size)
        totalSize += size
        if (metadata.expiresAt && metadata.expiresAt < now) {
          expiredCount++
        }
        entries.push({
          key: metadata.key,
          createdAt: metadata.createdAt,
          lastAccessedAt: metadata.lastAccessedAt,
          expiresAt: metadata.expiresAt,
          size,
        })
      }
    }
    return {
      count: entries.length,
      totalSize,
      expiredCount,
      entries: entries.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt),
    }
  } catch (error) {
    console.error(`Error getting cache stats for ${cacheName}:`, error)
    throw error
  }
}

/**
 * Force revalidation of a specific cache entry
 */
export const revalidateCacheEntry = async (
  cacheName: string,
  key: string,
  fetchFn: () => Promise<Response>
): Promise<Response> => {
  console.log(`[cache-middleware]: revalidate cache entry "${key}" of "${cacheName}" `)
  try {
    const response = await fetchFn()

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`)
    }
    const cache = await caches.open(cacheName)
    const metadataCache = await caches.open(`${cacheName}:metadata`)

    const now = Date.now()
    // Calculate expiration
    let expiresAt: number | null = null
    const headerMaxAge = parseMaxAge(response.headers.get('Cache-Control') || undefined)
    if (headerMaxAge) {
      expiresAt = now + headerMaxAge
    }
    // Store response and metadata
    await cache.put(key, response.clone())

    const metadata: CacheMetadata = {
      createdAt: now,
      lastAccessedAt: now,
      expiresAt,
      key,
    }

    await metadataCache.put(
      getMetadataKey(key),
      new Response(JSON.stringify(metadata), {
        headers: { 'Content-Type': 'application/json' },
      })
    )
    return response
  } catch (error) {
    console.error(`Error revalidating cache entry ${key}:`, error)
    throw error
  }
}
