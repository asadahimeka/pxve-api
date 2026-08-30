import type { MiddlewareHandler } from 'hono'

const store = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(opts?: { windowMs?: number; max?: number }): MiddlewareHandler {
  const windowMs = Number(Deno.env.get('RATE_LIMIT_WINDOW_MS') ?? opts?.windowMs ?? 60000)
  const max = Number(Deno.env.get('RATE_LIMIT_MAX') ?? opts?.max ?? 120)
  const enabled = (Deno.env.get('RATE_LIMIT_ENABLED') ?? '1') !== '0'
  return async (c, next) => {
    if (!enabled) return next()
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'unknown'
    const now = Date.now()
    const e = store.get(ip)
    if (!e || now > e.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs })
      return next()
    }
    e.count++
    if (e.count > max) {
      return c.json(
        { error: 'Rate limit exceeded' },
        429,
        { 'Retry-After': String(Math.ceil((e.resetAt - now) / 1000)) },
      )
    }
    return next()
  }
}
