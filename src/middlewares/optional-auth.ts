import type { MiddlewareHandler } from 'hono'
import crypto from 'node:crypto'
import { GET_API_TOKEN } from '@lib/const.ts'

export function optionalAuth(): MiddlewareHandler {
  const token = GET_API_TOKEN()
  return async (c, next) => {
    if (!token) return next()
    const hdr = c.req.header('authorization') ?? ''
    if (!safeEqual(hdr, `Bearer ${token}`)) return c.json({ error: 'Unauthorized' }, 401)
    return next()
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
