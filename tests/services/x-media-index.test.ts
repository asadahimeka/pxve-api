import assert from 'node:assert/strict'
import { test } from 'node:test'
// tests/services/x-media-index.test.ts
import { runFetchXMediaCmd } from '#services/x-media/index.ts'

// 仅覆盖 cookie 来源解析的错误分支（不触网）；有效 JSON 的成功路径由 live A/B 覆盖。

test('runFetchXMediaCmd - X_MEDIA_COOKIES invalid JSON surfaces clear error', async () => {
  process.env['X_MEDIA_COOKIES'] = '{bad json'
  try {
    await assert.rejects(
      () => runFetchXMediaCmd('k_rity'),
      (e: unknown) => e instanceof Error && e.message.includes('X_MEDIA_COOKIES must be valid JSON')
    )
  } finally {
    delete process.env['X_MEDIA_COOKIES']
  }
})

test('runFetchXMediaCmd - X_MEDIA_COOKIES missing fields surfaces clear error', async () => {
  process.env['X_MEDIA_COOKIES'] = '{"foo":"bar"}'
  try {
    await assert.rejects(
      () => runFetchXMediaCmd('k_rity'),
      (e: unknown) => e instanceof Error && e.message.includes('X_MEDIA_COOKIES is missing `auth_token` or `ct0`')
    )
  } finally {
    delete process.env['X_MEDIA_COOKIES']
  }
})

test('runFetchXMediaCmd - X_MEDIA_COOKIES array form rejected', async () => {
  process.env['X_MEDIA_COOKIES'] = '[{"name":"auth_token"}]'
  try {
    await assert.rejects(
      () => runFetchXMediaCmd('k_rity'),
      (e: unknown) => e instanceof Error && e.message.includes('X_MEDIA_COOKIES is missing `auth_token` or `ct0`')
    )
  } finally {
    delete process.env['X_MEDIA_COOKIES']
  }
})
