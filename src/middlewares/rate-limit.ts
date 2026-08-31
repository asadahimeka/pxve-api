import type { Context, MiddlewareHandler } from 'hono'
import { getConnInfo } from 'hono/deno'

const STORE_MAX = 5000

const store = new Map<string, { count: number; resetAt: number }>()

/**
 * Remove expired entries and enforce upper bound on store size.
 * Called lazily on each request; bounded by STORE_MAX.
 */
function cleanupStore(now: number): void {
  if (store.size === 0) return
  // Phase 1: evict expired entries
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
  // Phase 2: if still over cap, evict oldest (smallest resetAt) entries
  if (store.size > STORE_MAX) {
    const entries = [...store.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)
    const toRemove = entries.slice(0, store.size - STORE_MAX)
    for (const [key] of toRemove) {
      store.delete(key)
    }
  }
}

function getClientIP(c: Context) {
  const trustCloudflare = Deno.env.get('TRUST_CLOUDFLARE') === 'true'
  if (trustCloudflare) {
    return c.req.header('cf-connecting-ip') || 'unknown'
  }

  const realIP = c.req.header('x-real-ip')
  if (realIP) {
    return realIP
  }

  const xff = c.req.header('x-forwarded-for')
  if (xff) {
    return xff.split(',')[0].trim()
  }

  try {
    const connInfo = getConnInfo(c)
    return connInfo.remote.address || 'unknown'
  } catch {
    return 'unknown'
  }
}

export function rateLimit(opts?: { windowMs?: number; max?: number }): MiddlewareHandler {
  const windowMs = Number(Deno.env.get('RATE_LIMIT_WINDOW_MS') ?? opts?.windowMs ?? 60000)
  const max = Number(Deno.env.get('RATE_LIMIT_MAX') ?? opts?.max ?? 120)
  const enabled = (Deno.env.get('RATE_LIMIT_ENABLED') ?? '1') !== '0'

  return async (c, next) => {
    if (!enabled) return next()
    const ip = getClientIP(c)
    const now = Date.now()
    // Lazy cleanup of expired entries and size cap enforcement
    cleanupStore(now)
    const e = store.get(ip)
    if (!e || now > e.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs })
      return await next()
    }
    e.count++
    if (e.count > max) {
      return c.json({ error: 'Rate limit exceeded' }, 429, {
        'Retry-After': String(Math.ceil((e.resetAt - now) / 1000)),
      })
    }
    return await next()
  }
}
