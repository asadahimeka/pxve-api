import type { MiddlewareHandler } from 'hono'
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import { GET_API_TOKEN } from '@lib/const.ts'

const EXACT_WHITELIST = ['/docs', '/swagger', '/openapi.json', '/openapi-hibiapi.json', '/robots.txt', '/favicon.ico']
const PREFIX_WHITELIST = ['/docs', '/swagger']

function isWhitelisted(pathname: string): boolean {
  if (EXACT_WHITELIST.includes(pathname)) return true
  return PREFIX_WHITELIST.some(p => pathname.startsWith(p + '/'))
}

export function optionalAuth(): MiddlewareHandler {
  const token = GET_API_TOKEN()
  return async (c, next) => {
    if (!token) return next()
    if (isWhitelisted(new URL(c.req.url).pathname)) return next()
    // `Authorization` 可能需要留给上游（如 /pixiv-app-api/* 代理转发 Pixiv access token），
    // 因此网关 token 也可通过专用旁路头 `X-Api-Token` 携带；旁路头不会被转发到上游。
    const auth = c.req.header('authorization') ?? ''
    const apiToken = (c.req.header('x-api-token') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (safeEqual(auth, `Bearer ${token}`) || safeEqual(apiToken, token)) return await next()
    return c.json({ error: 'Unauthorized' }, 401)
  }
}

/**
 * Constant-time string equality (length-short-circuit, then timingSafeEqual).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}
