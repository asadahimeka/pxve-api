// src/services/x-media/api.ts
import { DEFAULT_UA, DOMAIN, getSharedTransaction, type XClientTransaction } from './transaction.ts'

export type { XClientTransaction }

// 公开 web Bearer token（twikit constants.py 原文，含字面 %3D；非敏感）
export const X_TOKEN =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'

// queryId 取自 twitscraper（2026 更新版，已验证可用）。若 X 滚动失效，从 x.com 前端 JS 重新提取。
export const USER_BY_SCREEN_NAME_URL = `https://${DOMAIN}/i/api/graphql/IGgvgiOx4QZndDHuD3x9TQ/UserByScreenName`
export const USER_MEDIA_URL = `https://${DOMAIN}/i/api/graphql/vFPc2LVIu7so2uA_gHQAdg/UserMedia`

// twitscraper 版 USER_FEATURES（10 键，配套其 queryId）
export const USER_FEATURES: Record<string, boolean> = {
  hidden_profile_subscriptions_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  subscriptions_verification_info_is_identity_verified_enabled: true,
  subscriptions_verification_info_verified_since_enabled: true,
  highlights_tweets_tab_ui_enabled: true,
  responsive_web_twitter_article_notes_tab_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
}

// 两侧相同的 FEATURES（21 键）
export const FEATURES: Record<string, boolean> = {
  creator_subscriptions_tweet_preview_api_enabled: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  rweb_video_timestamps_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  responsive_web_media_download_video_enabled: false,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_enhance_cards_enabled: false,
}

export function flattenParams(params: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) {
    out[k] = v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v)
  }
  return out
}

/** DFS：dict 先查自身键、再按插入序递归值；list 按序。findOne 命中即停。 */
export function findDict(obj: unknown, key: string, findOne = false): unknown[] {
  const results: unknown[] = []
  const walk = (node: unknown): boolean => {
    if (Array.isArray(node)) {
      for (const e of node) {
        if (walk(e) && findOne) return true
      }
      return false
    }
    if (node !== null && typeof node === 'object') {
      const rec = node as Record<string, unknown>
      if (key in rec) {
        results.push(rec[key])
        if (findOne) return true
      }
      for (const v of Object.values(rec)) {
        if (walk(v) && findOne) return true
      }
    }
    return false
  }
  walk(obj)
  return results
}

export interface XMediaItem {
  id: string | null
  media_url: string | null
  type: string | null
  width: number | null
  height: number | null
  stream_url: string | null
}

export interface XMediaTweet {
  id: string
  text: string | null
  full_text: string | null
  created_at: string | null
  favorite_count: number | null
  view_count: number | string | null
  media: XMediaItem[]
}

const KNOWN_MEDIA_TYPES = ['photo', 'video', 'animated_gif']

function streamUrl(m: Record<string, any>): string | null {
  const variants: any[] = m.video_info?.variants ?? []
  if (!variants.length) return null
  const pool = m.type === 'video' ? variants.filter((v) => String(v.content_type ?? '').startsWith('video')) : variants
  return pool[0]?.url ?? null
}

function mediaFromData(m: any): XMediaItem | null {
  if (!m || typeof m !== 'object' || !KNOWN_MEDIA_TYPES.includes(m.type)) {
    if (m?.type) console.error(`[x-media] unknown media type: ${m.type}`)
    return null
  }
  return {
    id: m.id_str ?? null,
    media_url: m.media_url_https ?? null,
    type: m.type,
    width: m.original_info?.width ?? null,
    height: m.original_info?.height ?? null,
    stream_url: streamUrl(m),
  }
}

/** tweet_from_data parity：find first 'result' → tombstone skip → unwrap tweet → require core + legacy。 */
export function tweetFromData(item: unknown): XMediaTweet | null {
  const found = findDict(item, 'result', true)
  const t = found[0] as Record<string, any> | undefined
  if (!t || typeof t !== 'object') return null
  if (t.__typename === 'TweetTombstone') return null
  const tw = 'tweet' in t ? t.tweet : t
  if (!tw || typeof tw !== 'object') return null
  if (!('core' in tw) || !('result' in (tw.core?.user_results ?? {}))) return null
  if (!('legacy' in tw)) return null
  const legacy = tw.legacy
  const text: string | null = legacy.full_text ?? null
  const noteText: string | null = tw.note_tweet?.note_tweet_results?.result?.text ?? null
  const mediaRaw: unknown[] = Array.isArray(legacy.entities?.media) ? legacy.entities.media : []
  return {
    id: tw.rest_id != null ? String(tw.rest_id) : '',
    text,
    full_text: noteText ?? text,
    created_at: legacy.created_at ?? null,
    favorite_count: legacy.favorite_count ?? null,
    view_count: tw.views?.count ?? null,
    media: mediaRaw.map(mediaFromData).filter((m): m is XMediaItem => m !== null),
  }
}

export interface XClientOptions {
  fetchImpl?: typeof fetch
  language?: string
  userAgent?: string
  transaction?: Promise<XClientTransaction>
}

export class XClient {
  private cookies: Record<string, string>
  private language: string
  private userAgent: string
  private fetchImpl: typeof fetch
  private transaction: Promise<XClientTransaction>

  constructor(cookies: Record<string, string>, opts: XClientOptions = {}) {
    this.cookies = cookies
    this.language = opts.language ?? 'en-US'
    this.userAgent = opts.userAgent ?? DEFAULT_UA
    this.fetchImpl = opts.fetchImpl ?? fetch
    this.transaction = opts.transaction ??
      getSharedTransaction({
        fetchImpl: this.fetchImpl,
        userAgent: this.userAgent,
        language: this.language,
        cookies: this.cookies, // transaction init 需要 x.com 登录态才能拿到 ondemand.s chunk map
      })
  }

  static async fromCookiesFile(path: string, opts: XClientOptions = {}): Promise<XClient> {
    const cookies = JSON.parse(await Deno.readTextFile(path))
    if (!cookies.auth_token || !cookies.ct0) {
      throw new Error(
        'cookies.json is missing `auth_token` or `ct0` — re-export cookies from a logged-in x.com session',
      )
    }
    return new XClient(cookies, opts)
  }

  private baseHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${X_TOKEN}`,
      'content-type': 'application/json',
      'X-Twitter-Auth-Type': 'OAuth2Session',
      'X-Twitter-Active-User': 'yes',
      Referer: `https://${DOMAIN}/`,
      'User-Agent': this.userAgent,
      'Accept-Language': this.language,
      'X-Twitter-Client-Language': this.language,
      Cookie: Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; '),
    }
    if (this.cookies['ct0']) headers['X-Csrf-Token'] = this.cookies['ct0']
    return headers
  }

  private async gqlGet(
    url: string,
    variables: Record<string, unknown>,
    features: Record<string, boolean>,
    extraParams?: Record<string, unknown>,
  ): Promise<any> {
    const params: Record<string, unknown> = { variables, features }
    if (extraParams) Object.assign(params, extraParams)
    const qs = new URLSearchParams(flattenParams(params))
    const tid = await (await this.transaction).generateTransactionId('GET', url)
    const res = await this.fetchImpl(`${url}?${qs}`, {
      headers: { ...this.baseHeaders(), 'X-Client-Transaction-Id': tid },
    })
    const body = await res.text()
    if (!res.ok) throw new Error(`x-api ${url} failed: ${res.status} ${body.slice(0, 300)}`)
    let json: any
    try {
      json = JSON.parse(body)
    } catch {
      throw new Error(`x-api ${url} returned non-JSON response: ${body.slice(0, 300)}`)
    }
    if (Array.isArray(json?.errors) && json.errors.length) {
      const { code, message } = json.errors[0]
      if (code === 37 || code === 64) throw new Error(`account suspended: ${message}`)
      if (code === 326) throw new Error(`account locked: ${message}`)
      throw new Error(`x-api error ${code}: ${message}`)
    }
    return json
  }

  async getUserIdByScreenName(screenName: string): Promise<string> {
    const json = await this.gqlGet(
      USER_BY_SCREEN_NAME_URL,
      { screen_name: screenName, withSafetyModeUserFields: false },
      USER_FEATURES,
      { fieldToggles: { withAuxiliaryUserLabels: false } },
    )
    const result = json?.data?.user?.result
    if (!result) throw new Error('The user does not exist.')
    if (result.__typename === 'UserUnavailable') throw new Error(result.message ?? 'User unavailable')
    if (result.rest_id == null) throw new Error('The user does not exist.')
    return String(result.rest_id)
  }

  async getUserMediaTimeline(
    userId: string,
    count: number,
    cursor: string | null,
  ): Promise<{ tweets: XMediaTweet[]; nextCursor: string | null; previousCursor: string | null }> {
    const variables: Record<string, unknown> = {
      userId,
      count,
      includePromotedContent: true,
      withQuickPromoteEligibilityTweetFields: true,
      withVoice: true,
      withV2Timeline: true,
    }
    if (cursor !== null) variables.cursor = cursor
    const json = await this.gqlGet(USER_MEDIA_URL, variables, FEATURES)
    const instructions = findDict(json, 'instructions', true)[0] as any
    if (!Array.isArray(instructions)) return { tweets: [], nextCursor: null, previousCursor: null }
    const entries: any[] = instructions.at(-1)?.entries ?? []
    const nextCursor = entries.at(-1)?.content?.value ?? null
    const previousCursor = entries.at(-2)?.content?.value ?? null
    const items: any[] = cursor === null ? entries[0]?.content?.items ?? [] : instructions[0]?.moduleItems ?? []
    const tweets: XMediaTweet[] = []
    for (const item of items) {
      const entryId: string = item?.entryId ?? ''
      if (
        !entryId.startsWith('tweet') && !entryId.startsWith('profile-conversation') &&
        !entryId.startsWith('profile-grid')
      ) continue
      const target = entryId.startsWith('profile-conversation') ? item?.content?.items?.[0] : item
      if (!target) continue
      const tweet = tweetFromData(target)
      if (tweet) tweets.push(tweet)
    }
    return { tweets, nextCursor, previousCursor }
  }
}
