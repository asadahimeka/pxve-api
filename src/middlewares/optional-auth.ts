import type { MiddlewareHandler } from 'hono'

export function optionalAuth(): MiddlewareHandler {
  return async (c, next) => {
    const token = Deno.env.get('API_TOKEN')?.trim()
    if (!token) return next()
    const hdr = c.req.header('authorization') ?? ''
    if (hdr !== `Bearer ${token}`) return c.json({ error: 'Unauthorized' }, 401)
    return next()
  }
}
