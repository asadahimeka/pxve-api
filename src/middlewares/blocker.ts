import type { MiddlewareHandler } from 'hono'
import { isbot } from 'isbot'
import { ACCEPT_DOMAINS, UA_BLACKLIST } from '@lib/const.ts'

function isAccepted(path: string, ua?: string, origin?: string, referer?: string): boolean {
  if (path === '/favicon.ico' || path === '/robots.txt') return true

  if (!ua) return false
  if (ua.includes('Uptime')) return true
  if (isbot(ua)) return false

  ua = ua.toLowerCase()
  if (UA_BLACKLIST.some(e => ua.includes(e.toLowerCase()))) {
    return false
  }

  let originOk = false
  if (!origin || !ACCEPT_DOMAINS.length || ACCEPT_DOMAINS.some(e => origin.includes(e))) {
    originOk = true
  }

  let refererOk = false
  if (!referer || !ACCEPT_DOMAINS.length || ACCEPT_DOMAINS.some(e => referer.includes(e))) {
    refererOk = true
  }

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
