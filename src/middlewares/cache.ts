import type { Context, MiddlewareHandler } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { sanitizeUrl } from '#lib/sanitize.ts'
import { createHttpCacheStore, type HttpCacheStore } from '#lib/http-cache-store.ts'
import { getEnv } from '#lib/runtime.ts'

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
 * Parse max-age from Cache-Control header
 */
const parseMaxAge = (cacheControl: string | undefined): number | null => {
  if (!cacheControl) return null
  const match = cacheControl.match(/max-age=(\d+)/i)
  return match ? parseInt(match[1], 10) * 1000 : null
}

const SENSITIVE_URL_PARAM_RE =
  /[?&](?:api[_-]?key|access[_-]?token|auth[_-]?token|token|PHPSESSID|ct0|secret|password)=/i

/**
 * Resolve the on-disk cache root. CACHE_DIR absolute → as-is; relative →
 * anchored to the repo root (never process.cwd()).
 */
function resolveCacheBaseDir(): string {
  const configured = getEnv('CACHE_DIR') ?? './.cache/http'
  if (configured.startsWith('/')) return configured
  return join(fileURLToPath(new URL('../../', import.meta.url)), configured)
}

function sanitizeCacheName(cacheName: string): string {
  return cacheName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'default'
}

// Store handles only (dir + limits). No entry data lives in memory:
// every match/put/stats reads disk. First creator wins on limits.
const stores = new Map<string, HttpCacheStore>()

function getStore(
  cacheName: string,
  opts?: { maxEntries?: number; maxSizeBytes?: number; defaultMaxAgeMs?: number }
): HttpCacheStore {
  const existing = stores.get(cacheName)
  if (existing) return existing
  const store = createHttpCacheStore({
    dir: join(resolveCacheBaseDir(), sanitizeCacheName(cacheName)),
    maxEntries: opts?.maxEntries ?? 5000,
    maxSizeBytes: opts?.maxSizeBytes,
    defaultMaxAgeMs: opts?.defaultMaxAgeMs,
  })
  stores.set(cacheName, store)
  return store
}

/**
 * Background task to periodically clean the cache
 */
const startBackgroundCleanup = (
  store: HttpCacheStore,
  options: {
    cleanupInterval?: number
  }
): (() => void) => {
  const { cleanupInterval = 5 * 60 * 1000 } = options
  const timerId = setInterval(async () => {
    try {
      await store.cleanup()
    } catch (error) {
      console.error('Error in background cleanup:', error)
    }
  }, cleanupInterval)
  // Housekeeping must not hold the event loop open on its own (keeps the
  // process/test runner able to exit; the HTTP server keeps it alive anyway).
  timerId.unref?.()
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
    const hasAuth = Boolean(
      c.req.header('authorization') || c.req.header('x-auth') || c.req.header('cookie')?.includes('PHPSESSID')
    )
    key = `${key}&auth=${hasAuth ? '1' : '0'}`

    const cacheName = typeof options.cacheName === 'function' ? await options.cacheName(c) : options.cacheName
    const store = getStore(cacheName, { maxEntries, maxSizeBytes, defaultMaxAgeMs: maxAge })

    // Start cleanup timer for this cache name if not already started
    if ((maxAge || maxSizeBytes || maxEntries) && !cleanupTimers.has(cacheName)) {
      const stopTimer = startBackgroundCleanup(store, { cleanupInterval })
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
    // I1: Bypass cache if URL contains sensitive query parameter names
    if (!shouldBypass) {
      shouldBypass = SENSITIVE_URL_PARAM_RE.test(c.req.url)
    }

    const cached = await store.match(key)

    // Return cached response if not expired or not forcing update.
    // (store.match returns null for expired entries and cleans them.)
    if (cached && !shouldBypass) {
      // Set the marker on the response we return: a bare `c.header()` is lost
      // when a middleware returns its own Response (Hono replaces context.res).
      const hit = new Response(cached.body, cached)
      hit.headers.set('X-Cache', 'HIT')
      return hit
    }

    // Delete expired or bypassed entry
    if (cached) {
      await store.delete(key)
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

    // NOTE: expired-then-refreshed reports MISS (was EXPIRED on Cache API).
    // No in-repo consumer distinguishes them; saves a disk read per miss.
    c.header('X-Cache', shouldBypass ? 'BYPASS' : 'MISS')

    const res = c.res.clone()

    // Expiration: response header wins, else the maxAge option (as store default).
    const headerMaxAge = parseMaxAge(c.res.headers.get('Cache-Control') || undefined)

    // Caching is best-effort: a disk-backed store adds failure modes (EACCES,
    // ENOSPC, read-only FS) that must never turn a good response into a 500.
    try {
      await store.put(key, res, headerMaxAge ?? undefined)
    } catch (error) {
      console.error('[cache-middleware]: store.put failed, serving uncached:', error)
      c.header('X-Cache', 'BYPASS')
    }
  }
}

/**
 * Manually clear all cache entries for a specific cache name
 */
export const clearCache = async (cacheName: string): Promise<void> => {
  console.log(`[cache-middleware]: clear cache "${cacheName}" `)
  try {
    await getStore(cacheName).clear()
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
    return await getStore(cacheName).delete(key)
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
    const stats = await getStore(cacheName).stats()
    return {
      count: stats.entries,
      totalSize: stats.bytes,
      expiredCount: stats.expiredCount,
      entries: stats.items
        .map(m => ({
          key: m.key,
          createdAt: m.createdAt,
          lastAccessedAt: m.lastAccessedAt,
          expiresAt: m.expiresAt,
          size: m.size,
        }))
        .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt),
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

    // Calculate expiration (response header only, same as before)
    const headerMaxAge = parseMaxAge(response.headers.get('Cache-Control') || undefined)

    // Store response (store enforces its default limits after put)
    await getStore(cacheName).put(key, response.clone(), headerMaxAge ?? undefined)
    return response
  } catch (error) {
    console.error(`Error revalidating cache entry ${key}:`, error)
    throw error
  }
}
