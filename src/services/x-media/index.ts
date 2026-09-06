// src/services/x-media/index.ts — native Deno implementation (no Python subprocess).
// Legacy Python fallback kept at ./fetch_x_media.py for A/B comparison only.
import { join } from '@std/path'
import { XClient } from './api.ts'

const DEFAULT_LIMIT = 40
const userNameRe = /^[A-Za-z0-9_]{1,15}$/
const cursorRe = /^[A-Za-z0-9_\-=+/]{1,64}$/

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

  // cookies.json is re-read per request: editing the file takes effect without restart.
  const client = await XClient.fromCookiesFile(join(import.meta.dirname!, 'cookies.json'))
  const id = userId ?? (await client.getUserIdByScreenName(userName!))
  const { tweets, nextCursor: nc } = await client.getUserMediaTimeline(id, DEFAULT_LIMIT, nextCursor ?? null)
  return { results: tweets, next_cursor: nc, user_id: id }
}
