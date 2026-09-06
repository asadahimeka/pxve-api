// tests/services/x-media-api.test.ts
import { assertEquals, assertRejects } from '@std/assert'
import {
  FEATURES,
  findDict,
  tweetFromData,
  USER_BY_SCREEN_NAME_URL,
  USER_FEATURES,
  USER_MEDIA_URL,
  X_TOKEN,
  XClient,
  XClientTransaction,
} from '@services/x-media/api.ts'

/** Route-map fetch mock（同 transaction 测试）。 */
function mockApi(routes: [string | RegExp, { status: number; body: unknown }][]) {
  const calls: { url: string; init?: RequestInit }[] = []
  const impl = ((url: string | URL | Request, init?: RequestInit) => {
    const u = String(url)
    calls.push({ url: u, init })
    for (const [match, { status, body }] of routes) {
      if (typeof match === 'string' ? u.startsWith(match) : match.test(u)) {
        return Promise.resolve(
          new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
        )
      }
    }
    return Promise.resolve(new Response('not found', { status: 404 }))
  }) as typeof fetch
  return { impl, calls }
}

/** tid stub：记录收到的 method/path，固定返回 TESTTID。 */
function stubTx(seen: { method: string; url: string }[]) {
  return {
    generateTransactionId: (method: string, url: string) => {
      seen.push({ method, url })
      return Promise.resolve('TESTTID')
    },
  } as unknown as XClientTransaction
}

const legacyOf = (media: unknown[] = []) => ({
  created_at: 'Mon Sep 01 12:00:00 +0000 2025',
  full_text: 'hello',
  favorite_count: 7,
  entities: { media },
})

const tweetResult = (id: string, legacy: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  __typename: 'Tweet',
  rest_id: id,
  core: { user_results: { result: { __typename: 'User', rest_id: '42', legacy: { screen_name: 't' } } } },
  legacy,
  views: { count: '123', state: 'EnabledWithCount' },
  ...extra,
})

const itemOf = (entryId: string, result: unknown) => ({
  entryId,
  item: { itemContent: { itemType: 'TimelineTweet', __typename: 'TimelineTweet', tweet_results: { result } } },
})

const photo = {
  id_str: 'm1',
  type: 'photo',
  media_url_https: 'https://pbs.twimg.com/media/m1.jpg',
  original_info: { width: 100, height: 50 },
}
const gif = {
  id_str: 'm2',
  type: 'animated_gif',
  media_url_https: 'https://pbs.twimg.com/media/m2.jpg',
  original_info: { width: 10, height: 10 },
  video_info: { variants: [{ content_type: 'video/mp4', url: 'https://video.twimg.com/m2.mp4' }] },
}
const video = {
  id_str: 'm3',
  type: 'video',
  media_url_https: 'https://pbs.twimg.com/media/m3.jpg',
  original_info: { width: 320, height: 240 },
  video_info: {
    variants: [
      { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/m3.m3u8' },
      { content_type: 'video/mp4', url: 'https://video.twimg.com/m3.mp4' },
    ],
  },
}

const userSearchOk = { data: { user: { result: { __typename: 'User', rest_id: '804284210529742848', legacy: {} } } } }

const mediaFirstPage = {
  data: {
    user: {
      result: {
        timeline_v2: {
          timeline: {
            instructions: [
              { type: 'TimelineAddEntries', entries: [] },
              {
                type: 'TimelineAddEntries',
                entries: [
                  {
                    entryId: 'profile-grid-0',
                    content: {
                      items: [
                        itemOf('tweet-1001', tweetResult('1001', legacyOf([photo, video]))),
                        itemOf(
                          'tweet-1002',
                          tweetResult('1002', legacyOf([gif]), {
                            note_tweet: { note_tweet_results: { result: { text: 'long note text' } } },
                            views: {},
                          }),
                        ),
                        itemOf('tweet-1003', { __typename: 'TweetTombstone', text: { text: 'gone' } }),
                      ],
                    },
                  },
                  { entryId: 'cursor-top-0', content: { value: 'PREV', cursorType: 'Top' } },
                  { entryId: 'cursor-bottom-0', content: { value: 'NEXT', cursorType: 'Bottom' } },
                ],
              },
            ],
          },
        },
      },
    },
  },
}

Deno.test('getUserByScreenName - request shape + id parsing', async () => {
  const { impl, calls } = mockApi([[USER_BY_SCREEN_NAME_URL, { status: 200, body: userSearchOk }]])
  const seen: { method: string; url: string }[] = []
  const client = new XClient(
    { auth_token: 'tok', ct0: 'csrf' },
    { fetchImpl: impl, transaction: Promise.resolve(stubTx(seen)) },
  )
  const id = await client.getUserIdByScreenName('k_rity')
  assertEquals(id, '804284210529742848')
  assertEquals(seen, [{
    method: 'GET',
    url: 'https://x.com/i/api/graphql/IGgvgiOx4QZndDHuD3x9TQ/UserByScreenName',
  }]) // stub 收到的是完整 URL；取 pathname 是真实 XClientTransaction 类内部的事（Task 3 已覆盖）
  const u = new URL(calls[0]!.url)
  assertEquals(JSON.parse(u.searchParams.get('variables')!), { screen_name: 'k_rity', withSafetyModeUserFields: false })
  assertEquals(JSON.parse(u.searchParams.get('features')!), USER_FEATURES)
  assertEquals(JSON.parse(u.searchParams.get('fieldToggles')!), { withAuxiliaryUserLabels: false })
  const h = new Headers(calls[0]!.init!.headers)
  assertEquals(h.get('authorization'), `Bearer ${X_TOKEN}`)
  assertEquals(h.get('X-Csrf-Token'), 'csrf')
  assertEquals(h.get('Cookie'), 'auth_token=tok; ct0=csrf')
  assertEquals(h.get('X-Client-Transaction-Id'), 'TESTTID')
  assertEquals(h.get('X-Twitter-Auth-Type'), 'OAuth2Session')
})

Deno.test('getUserByScreenName - missing user / unavailable', async () => {
  const mk = (body: unknown) => {
    const { impl } = mockApi([[USER_BY_SCREEN_NAME_URL, { status: 200, body }]])
    return new XClient({ auth_token: 't', ct0: 'c' }, { fetchImpl: impl, transaction: Promise.resolve(stubTx([])) })
  }
  await assertRejects(() => mk({ data: {} }).getUserIdByScreenName('x'), Error, 'The user does not exist.')
  await assertRejects(
    () =>
      mk({ data: { user: { result: { __typename: 'UserUnavailable', message: 'Suspended' } } } }).getUserIdByScreenName(
        'x',
      ),
    Error,
    'Suspended',
  )
})

Deno.test('getUserMediaTimeline - first page parses grid tweets', async () => {
  const { impl } = mockApi([[USER_MEDIA_URL, { status: 200, body: mediaFirstPage }]])
  const client = new XClient({ auth_token: 't', ct0: 'c' }, {
    fetchImpl: impl,
    transaction: Promise.resolve(stubTx([])),
  })
  const { tweets, nextCursor, previousCursor } = await client.getUserMediaTimeline('42', 40, null)
  assertEquals(nextCursor, 'NEXT')
  assertEquals(previousCursor, 'PREV')
  assertEquals(tweets.length, 2)
  assertEquals(tweets[0]!.id, '1001')
  assertEquals(tweets[0]!.view_count, '123')
  assertEquals(tweets[0]!.media, [
    {
      id: 'm1',
      media_url: 'https://pbs.twimg.com/media/m1.jpg',
      type: 'photo',
      width: 100,
      height: 50,
      stream_url: null,
    },
    {
      id: 'm3',
      media_url: 'https://pbs.twimg.com/media/m3.jpg',
      type: 'video',
      width: 320,
      height: 240,
      stream_url: 'https://video.twimg.com/m3.mp4',
    },
  ])
  assertEquals(tweets[1]!.id, '1002')
  assertEquals(tweets[1]!.text, 'hello')
  assertEquals(tweets[1]!.full_text, 'long note text')
  assertEquals(tweets[1]!.view_count, null)
  assertEquals(tweets[1]!.media[0]!.stream_url, 'https://video.twimg.com/m2.mp4')
})

const mediaCursorPage = {
  data: {
    user: {
      result: {
        timeline_v2: {
          timeline: {
            instructions: [
              {
                type: 'TimelineAddModule',
                moduleItems: [
                  itemOf('tweet-2001', tweetResult('2001', legacyOf([gif]))),
                  {
                    entryId: 'profile-conversation-2002',
                    content: {
                      items: [
                        itemOf('tweet-2002', tweetResult('2002', legacyOf([]))),
                        itemOf('tweet-2002-r1', tweetResult('2002r', legacyOf([]))),
                      ],
                    },
                  },
                ],
              },
              {
                type: 'TimelineAddEntries',
                entries: [
                  { entryId: 'cursor-top-1', content: { value: 'PREV2', cursorType: 'Top' } },
                  { entryId: 'cursor-bottom-1', content: { value: 'NEXT2', cursorType: 'Bottom' } },
                ],
              },
            ],
          },
        },
      },
    },
  },
}

Deno.test('getUserMediaTimeline - cursor page parses moduleItems', async () => {
  const { impl, calls } = mockApi([[USER_MEDIA_URL, { status: 200, body: mediaCursorPage }]])
  const client = new XClient({ auth_token: 't', ct0: 'c' }, {
    fetchImpl: impl,
    transaction: Promise.resolve(stubTx([])),
  })
  const { tweets, nextCursor, previousCursor } = await client.getUserMediaTimeline('42', 40, 'CUR')
  assertEquals(nextCursor, 'NEXT2')
  assertEquals(previousCursor, 'PREV2')
  assertEquals(tweets.map((t) => t.id), ['2001', '2002']) // conversation 取首条，replies 被忽略（与 Python 脚本输出一致）
  assertEquals(tweets[0]!.media[0]!.stream_url, 'https://video.twimg.com/m2.mp4')
  const u = new URL(calls[0]!.url)
  assertEquals(JSON.parse(u.searchParams.get('variables')!), {
    userId: '42',
    count: 40,
    includePromotedContent: true,
    withQuickPromoteEligibilityTweetFields: true,
    withVoice: true,
    withV2Timeline: true,
    cursor: 'CUR',
  })
  assertEquals(JSON.parse(u.searchParams.get('features')!), FEATURES)
})

Deno.test('getUserMediaTimeline - errors surface', async () => {
  const mk = (status: number, body: unknown) => {
    const { impl } = mockApi([[USER_MEDIA_URL, { status, body }]])
    return new XClient({ auth_token: 't', ct0: 'c' }, { fetchImpl: impl, transaction: Promise.resolve(stubTx([])) })
  }
  await assertRejects(() => mk(429, 'Rate Limit').getUserMediaTimeline('42', 40, null), Error, '429')
  await assertRejects(
    () => mk(200, { errors: [{ code: 326, message: 'locked' }] }).getUserMediaTimeline('42', 40, null),
    Error,
    'locked',
  )
  const empty = await mk(200, { data: {} }).getUserMediaTimeline('42', 40, null)
  assertEquals(empty, { tweets: [], nextCursor: null, previousCursor: null })
})

Deno.test('tweetFromData / findDict tolerate malformed items', () => {
  assertEquals(tweetFromData(null), null)
  assertEquals(tweetFromData({ __typename: 'TweetTombstone' }), null)
  assertEquals(findDict({ a: [{ result: 1 }] }, 'result', true), [1])
})
