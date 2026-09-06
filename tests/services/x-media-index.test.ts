// tests/services/x-media-index.test.ts
import { assertRejects } from '@std/assert'
import { runFetchXMediaCmd } from '@services/x-media/index.ts'

// 仅覆盖 cookie 来源解析的错误分支（不触网）；有效 JSON 的成功路径由 live A/B 覆盖。

Deno.test('runFetchXMediaCmd - X_MEDIA_COOKIES invalid JSON surfaces clear error', async () => {
  Deno.env.set('X_MEDIA_COOKIES', '{bad json')
  try {
    await assertRejects(
      () => runFetchXMediaCmd('k_rity'),
      Error,
      'X_MEDIA_COOKIES must be valid JSON',
    )
  } finally {
    Deno.env.delete('X_MEDIA_COOKIES')
  }
})

Deno.test('runFetchXMediaCmd - X_MEDIA_COOKIES missing fields surfaces clear error', async () => {
  Deno.env.set('X_MEDIA_COOKIES', '{"foo":"bar"}')
  try {
    await assertRejects(
      () => runFetchXMediaCmd('k_rity'),
      Error,
      'X_MEDIA_COOKIES is missing `auth_token` or `ct0`',
    )
  } finally {
    Deno.env.delete('X_MEDIA_COOKIES')
  }
})

Deno.test('runFetchXMediaCmd - X_MEDIA_COOKIES array form rejected', async () => {
  Deno.env.set('X_MEDIA_COOKIES', '[{"name":"auth_token"}]')
  try {
    await assertRejects(
      () => runFetchXMediaCmd('k_rity'),
      Error,
      'X_MEDIA_COOKIES is missing `auth_token` or `ct0`',
    )
  } finally {
    Deno.env.delete('X_MEDIA_COOKIES')
  }
})
