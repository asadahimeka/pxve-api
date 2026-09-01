import { assertEquals, assertExists } from '@std/assert'
import { callPixivAction, pixivActionKeys, pixivActionMap } from '../../../src/services/pixiv/action.ts'

Deno.test('pixivActionMap - contains expected actions', () => {
  const expectedActions = [
    'illust',
    'member',
    'illust_recommended',
    'user_recommended',
    'illust_new',
    'manga_new',
    'novel_new',
    'search_autocomplete',
    'popular_preview',
    'search_user',
    'member_illust',
    'member_novel',
    'favorite',
    'follower',
    'following',
    'rank',
    'rank_novel',
    'search',
    'search_novel',
    'tags',
    'tags_novel',
    'related',
    'related_novel',
    'ugoira_metadata',
    'illust_comments',
    'novel_comments',
  ]
  for (const action of expectedActions) {
    assertExists(pixivActionMap[action], `Action ${action} should exist`)
  }
})

Deno.test('pixivActionKeys - returns array of action keys', () => {
  assertEquals(Array.isArray(pixivActionKeys), true)
  assertEquals(pixivActionKeys.length > 0, true)
  assertEquals(pixivActionKeys.includes('illust'), true)
  assertEquals(pixivActionKeys.includes('member'), true)
})

Deno.test('pixivActionMap - each action has function and expire', () => {
  for (const [key, action] of Object.entries(pixivActionMap)) {
    assertEquals(Array.isArray(action), true)
    const [fn, expire] = action
    assertEquals(typeof fn, 'function', `Action ${key} should have a function`)
    assertEquals(typeof expire, 'number', `Action ${key} should have expire time`)
  }
})

Deno.test('pixivActionMap - illust action has correct expire time', () => {
  const [_, expire] = pixivActionMap.illust
  assertEquals(expire, 60 * 60 * 24 * 7)
})

Deno.test('pixivActionMap - member action has correct expire time', () => {
  const [_, expire] = pixivActionMap.member
  assertEquals(expire, 60 * 60 * 24)
})

Deno.test('pixivActionMap - rank action has correct expire time', () => {
  const [_, expire] = pixivActionMap.rank
  assertEquals(expire, 60 * 60 * 24 * 14)
})

Deno.test('pixivActionMap - search action has correct expire time', () => {
  const [_, expire] = pixivActionMap.search
  assertEquals(expire, 60 * 60 * 1)
})

Deno.test('callPixivAction - returns null for unknown action', async () => {
  const result = await callPixivAction('unknown_action', {})
  assertEquals(result, null)
})

Deno.test('callPixivAction - returns null for action without validation', async () => {
  const result = await callPixivAction('spotlights', {})
  assertExists(result)
})
