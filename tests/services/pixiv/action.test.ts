import { callPixivAction, pixivActionKeys, pixivActionMap } from '../../../src/services/pixiv/action.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('pixivActionMap - contains expected actions', () => {
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
    assert.ok(pixivActionMap[action] !== null && pixivActionMap[action] !== undefined, `Action ${action} should exist`)
  }
})

test('pixivActionKeys - returns array of action keys', () => {
  assert.deepEqual(Array.isArray(pixivActionKeys), true)
  assert.deepEqual(pixivActionKeys.length > 0, true)
  assert.deepEqual(pixivActionKeys.includes('illust'), true)
  assert.deepEqual(pixivActionKeys.includes('member'), true)
})

test('pixivActionMap - each action has function and expire', () => {
  for (const [key, action] of Object.entries(pixivActionMap)) {
    assert.deepEqual(Array.isArray(action), true)
    const [fn, expire] = action
    assert.deepEqual(typeof fn, 'function', `Action ${key} should have a function`)
    assert.deepEqual(typeof expire, 'number', `Action ${key} should have expire time`)
  }
})

test('pixivActionMap - illust action has correct expire time', () => {
  const [_, expire] = pixivActionMap.illust
  assert.deepEqual(expire, 60 * 60 * 24 * 7)
})

test('pixivActionMap - member action has correct expire time', () => {
  const [_, expire] = pixivActionMap.member
  assert.deepEqual(expire, 60 * 60 * 24)
})

test('pixivActionMap - rank action has correct expire time', () => {
  const [_, expire] = pixivActionMap.rank
  assert.deepEqual(expire, 60 * 60 * 24 * 14)
})

test('pixivActionMap - search action has correct expire time', () => {
  const [_, expire] = pixivActionMap.search
  assert.deepEqual(expire, 60 * 60 * 1)
})

test('callPixivAction - returns null for unknown action', async () => {
  const result = await callPixivAction('unknown_action', {})
  assert.deepEqual(result, null)
})

test('callPixivAction - returns null for action without validation', async () => {
  const result = await callPixivAction('spotlights', {})
  assert.ok(result !== null && result !== undefined)
})
