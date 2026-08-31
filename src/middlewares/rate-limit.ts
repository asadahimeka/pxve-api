import type { Context, MiddlewareHandler } from 'hono'

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
  return (
    c.req.header('x-real-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('cf-connecting-ip') ||
    'unknown'
  )
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
