import type { MiddlewareHandler } from 'hono'
import { isbot } from 'isbot'
import { GET_ACCEPT_DOMAINS, UA_BLACKLIST } from '@lib/const.ts'

/**
 * Precise origin matching: exact hostname match or wildcard (*.domain) endsWith.
 * Empty ACCEPT_DOMAINS falls back to allow-all with a warning.
 */
export function isAllowedOrigin(origin: string): boolean {
  const list = GET_ACCEPT_DOMAINS()
  if (!list.length) {
    console.warn('[blocker] ACCEPT_DOMAINS empty, CORS allows *')
    return true
  }
  try {
    const h = new URL(origin).hostname
    return list.some(d => (d.startsWith('*.') ? h === d.slice(2) || h.endsWith(d.slice(1)) : h === d))
  } catch {
    return false
  }
}

function isAccepted(path: string, ua?: string, origin?: string, referer?: string): boolean {
  if (path === '/favicon.ico' || path === '/robots.txt') return true

  if (!ua) return false
  if (ua.includes('Uptime')) return true
  if (isbot(ua)) return false

  ua = ua.toLowerCase()
  if (UA_BLACKLIST.some(e => ua.includes(e.toLowerCase()))) {
    return false
  }

  const originOk = !origin || isAllowedOrigin(origin)
  const refererOk = !referer || isAllowedOrigin(referer)

  return originOk && refererOk
}

export function blocker(): MiddlewareHandler {
  return async (ctx, next) => {
    const ua = ctx.req.header('User-Agent')
    const origin = ctx.req.header('Origin')
    const referer = ctx.req.header('Referer')

    if (isAccepted(ctx.req.path, ua, origin, referer)) {
      await next()
      return
    }

    return ctx.json({ error: 'Forbidden' }, 403)
  }
}
