// src/services/x-media/index.ts — native Deno implementation (no Python subprocess).
// Legacy Python fallback kept at ./fetch_x_media.py for A/B comparison only.
import { join } from '@std/path'
import { XClient } from './api.ts'

const DEFAULT_LIMIT = 40
const userNameRe = /^[A-Za-z0-9_]{1,15}$/
const cursorRe = /^[A-Za-z0-9_\-=+/]{1,64}$/

/**
 * Cookie 来源优先级：X_MEDIA_COOKIES（JSON 环境变量，PaaS 友好）→
 * X_MEDIA_COOKIES_FILE（自定义路径，如 docker secrets）→ 默认 cookies.json（每请求重读，热更新）。
 */
// deno-lint-ignore require-await
async function createXClient(): Promise<XClient> {
  const envJson = Deno.env.get('X_MEDIA_COOKIES')
  if (envJson) {
    let cookies: Record<string, string>
    try {
      cookies = JSON.parse(envJson)
    } catch {
      throw new Error('X_MEDIA_COOKIES must be valid JSON, e.g. {"auth_token":"...","ct0":"..."}')
    }
    if (!cookies || typeof cookies !== 'object' || Array.isArray(cookies) || !cookies.auth_token || !cookies.ct0) {
      throw new Error(
        'X_MEDIA_COOKIES is missing `auth_token` or `ct0` — re-export cookies from a logged-in x.com session'
      )
    }
    return new XClient(cookies)
  }
  // cookies.json is re-read per request: editing the file takes effect without restart.
  const path = Deno.env.get('X_MEDIA_COOKIES_FILE') ?? join(import.meta.dirname!, 'cookies.json')
  return XClient.fromCookiesFile(path)
}

export async function runFetchXMediaCmd(userName?: string, userId?: string, nextCursor?: string) {
  if (!userName && !userId) {
    throw new Error('`userName` or `userId` is required.')
  }
  if (userName && !userNameRe.test(userName)) {
    throw new Error('`userName` must be 1-15 alphanumeric/underscore characters.')
  }
  if (userId && !/^\d+$/.test(userId)) {
    throw new Error('`userId` should be numeric.')
  }
  if (nextCursor && !cursorRe.test(nextCursor)) {
    throw new Error('`nextCursor` must be 1-64 alphanumeric/underscore/hyphen/base64 characters.')
  }

  const client = await createXClient()
  const id = userId ?? (await client.getUserIdByScreenName(userName!))
  const { tweets, nextCursor: nc } = await client.getUserMediaTimeline(id, DEFAULT_LIMIT, nextCursor ?? null)
  return { results: tweets, next_cursor: nc, user_id: id }
}
