// Ported from `@__dirname/pixiv-web-api@0.1.4` (dist/index.js + dist/*.d.ts).
// The published package ships an ESM `dist/index.d.ts` that re-exports extension-less
// subpaths resolved through a bundler-only path alias (`@/request`), which `nodenext`
// cannot resolve — so the whole namespace degrades to `any`/empty under `tsc`.
// This single self-contained file is the runtime behaviour of 0.1.4 plus its types.
// Zero runtime dependencies; do not import anything here.

export interface Options {
  fetch?: typeof globalThis.fetch
  baseURL?: string
  acceptLanguage?: string
  cookie?: string
  xUserId?: number | string
}

const options: Options = {
  fetch: globalThis.fetch,
  baseURL: 'https://www.pixiv.net',
}

export const setOptions = (partialOptions: Partial<Options>): void => {
  Object.assign(options, partialOptions)
}

export const getOptions = (): Readonly<Options> => options

export const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined'

export type RequestQuery = Record<string, string | number | undefined | Array<string | number>>

export type Query<T extends RequestQuery = {}> = {
  version?: string
  lang?: string | 'zh'
} & T

export type RequestType = 'json' | 'form' | 'formdata'

export class PixivWebAPIError extends Error {
  name = 'PixivWebAPIError'
  constructor(message: string) {
    super(message)
  }
}

export const request = (
  endpoint: string,
  query: RequestQuery = {},
  data?: any,
  type: RequestType = 'json'
): Promise<Response> => {
  const {
    fetch = globalThis.fetch,
    baseURL = 'https://www.pixiv.net',
    cookie,
    xUserId,
    acceptLanguage,
  } = getOptions()
  const url = new URL(baseURL + endpoint)
  Object.entries(query).forEach(([k, v]) => {
    if (v == undefined) return
    if (Array.isArray(v)) {
      v.forEach(vv => url.searchParams.append(k, vv.toString()))
    } else {
      url.searchParams.append(k, v.toString())
    }
  })
  const headers = new Headers()
  if (cookie) headers.set('Cookie', cookie)
  if (xUserId) headers.set('X-User-Id', xUserId.toString())
  if (isBrowser) {
    headers.set('Accept-Language', acceptLanguage ?? 'zh-CN')
  } else {
    if (acceptLanguage) headers.set('Accept-Language', acceptLanguage)
    headers.set(
      'User-Agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.3'
    )
    headers.set('Referer', 'https://www.pixiv.net')
  }
  let body = undefined
  if (data) {
    switch (type) {
      case 'json': {
        headers.set('Content-type', 'application/json; charset=utf-8')
        body = JSON.stringify(data)
        break
      }
      case 'form': {
        headers.set('Content-type', 'application/x-www-form-urlencoded')
        body = new URLSearchParams(data)
        break
      }
      case 'formdata': {
        const fd = new FormData()
        for (const [key, val] of Object.entries(data)) {
          fd.append(
            key,
            val instanceof Blob ? val : typeof val === 'object' ? JSON.stringify(val) : String(val)
          )
        }
        body = fd
        break
      }
    }
  }
  return fetch(String(url), {
    method: data ? 'POST' : 'GET',
    body,
    headers,
    referrerPolicy: isBrowser ? 'no-referrer' : undefined,
  })
}

export const requestJSON = async <T = any>(
  endpoint: string,
  query: RequestQuery = {},
  data?: any,
  type?: RequestType
): Promise<T> => {
  const res = await request(endpoint, query, data, type)
  if (res.ok) {
    try {
      return (await res.json()) as T
    } catch {
      throw new PixivWebAPIError(`Failed to parse JSON for url (${res.url})`)
    }
  } else {
    throw new PixivWebAPIError(`HTTP response is not ok (${res.status}) for url (${res.url})`)
  }
}

export const requestJSONAPI = async <T = any, U = unknown>(
  endpoint: string,
  query: RequestQuery = {},
  data?: any,
  type?: RequestType
): Promise<T> => {
  const json = await requestJSON(endpoint, query, data, type)
  if (json.error) {
    throw new PixivWebAPIError(json.message)
  } else {
    return json.body
  }
}

export const discovery = (
  type: 'artworks' | 'novels' | 'users',
  query: Query<{
    mode: string | 'all'
    limit: number
  }>
): Promise<any> => requestJSONAPI(`/ajax/discovery/${type}`, query)

export const favoriteTagsSave = (data: { tags: string[] }): Promise<any> =>
  requestJSONAPI(`/ajax/favorite_tags/save`, undefined, data)

export const followLatest = (
  type: 'illust' | 'novels',
  query?: Query<{
    p: number
    mode?: 'all' | 'r18'
  }>
): Promise<any> => requestJSONAPI(`/ajax/follow_latest/${type}`, query)

export const illust = (id: number, query?: Query): Promise<any> => requestJSONAPI(`/ajax/illust/${id}`, query)

export const illustPages = (
  id: number
): Promise<{
  urls: {
    thumb_mini: string
    small: string
    regular: string
    original: string
  }
  width: number
  height: number
}[]> => requestJSONAPI(`/ajax/illust/${id}/pages`)

export const illustRecommendInit = (
  id: number,
  query: Query<{
    limit: number
  }>
): Promise<{
  illusts: any[]
  nextIds: any[]
  details: any[]
}> => requestJSONAPI(`/ajax/illust/${id}/recommend/init`, query)

export const illustRecommendIllusts = (
  query: Query<{
    illust_ids: number[]
  }>
): Promise<any> => requestJSONAPI(`/ajax/illust/recommend/illusts`, query)

export const illustDiscovery = (query: {
  mode?: 'all' | 'safe' | 'r18'
  max: number
}): Promise<any> => requestJSONAPI(`/ajax/illust/discovery`, query)

export const illustUgoiraMeta = (id: number): Promise<any> =>
  requestJSONAPI(`/ajax/illust/${id}/ugoira_meta`)

export const illustsLike = (data: { illust_id: number }): Promise<any> =>
  requestJSONAPI(`/ajax/illusts/like`, undefined, data)

export const illustsCommentsRoots = (
  query: Query<{
    illust_id: number
    limit: number
    offset: number
  }>
): Promise<any> => requestJSONAPI(`/ajax/illusts/comments/roots`, query)

export const illustsCommentsReplies = (query: { comment_id: number; page: number }): Promise<any> =>
  requestJSONAPI(`/ajax/illusts/comments/replies`, query)

export const rpcPostComment = (data: {
  type: 'comment' | 'stamp'
  illust_id: number
  author_user_id: number
  comment: string
}): Promise<any> => requestJSONAPI(`/rpc/post_comment.php`, undefined, data, 'form')

export const rpcDeleteComment = (data: { i_id: number; del_id: number }): Promise<any> =>
  requestJSONAPI(`/rpc_delete_comment.php`, undefined, data, 'form')

export const illustNew = (
  query: Query<{
    lastId: number
    limit: number
    type: 'illust' | 'manga' | 'novel'
    r18: 'true' | 'false'
  }>
): Promise<any> => requestJSONAPI(`/ajax/illust/new`, query)

export const illustSeriesWatch = (id: number): Promise<any> =>
  requestJSONAPI(`/ajax/illust/series/${id}/watch`)

export const illustSeriesUnwatch = (id: number): Promise<any> =>
  requestJSONAPI(`/ajax/illust/series/${id}/unwatch`)

export const illustSeriesWatchlistNotificationTurnOn = (id: number): Promise<any> =>
  requestJSONAPI(`/ajax/illust/series/${id}/watchlist/notification/turn_on`, undefined, {})

export const illustSeriesWatchlistNotificationTurnOff = (id: number): Promise<any> =>
  requestJSONAPI(`/ajax/illust/series/${id}/watchlist/notification/turn_off`, undefined, {})

export const illustBookmarksAdd = (data: {
  illust_id: `${number}`
  restrict?: 0 | 1
  comment: string
  tags: string[]
}): Promise<{
  last_bookmark_id: `${number}`
  stacc_status_id: `${number}`
}> => requestJSONAPI(`/ajax/illusts/bookmarks/add`, undefined, data)

export const illustsBookmarksDelete = (data: { bookmark_id: `${number}` }): Promise<any> =>
  requestJSONAPI(`/ajax/illusts/bookmarks/delete`, undefined, data, 'form')

export const illustsBookmarksRemove = (data: { bookmark_ids: number[] }): Promise<any> =>
  requestJSONAPI(`/ajax/illusts/bookmarks/remove`, undefined, data)

export const illustsBookmarksEditRestrict = (data: {
  bookmark_ids: number[]
  bookmark_restrict: 'private' | 'public'
}): Promise<any> => requestJSONAPI(`/ajax/illusts/bookmarks/edit_restrict`, undefined, data)

export const illustsBookmarksAddTags = (data: {
  bookmark_ids: number[]
  tags: string[]
}): Promise<any> => requestJSONAPI(`/ajax/illusts/bookmarks/add_tags`, undefined, data)

export const muteItemsAdd = (data: {
  context: 'user'
  type: 'user'
  value: number
}): Promise<any> => requestJSONAPI(`/ajax/mute/items/add`, undefined, data, 'form')

export const muteItemsDelete = (data: {
  context: 'user'
  type: 'user'
  value: number
}): Promise<any> => requestJSONAPI(`/ajax/mute/items/delete`, undefined, data, 'form')

export const myProfile = (): Promise<any> => requestJSONAPI(`/ajax/my_profile`)

export const myProfileUpdate = (data: FormData): Promise<any> =>
  requestJSONAPI(`/ajax/my_profile/update`, undefined, data)

export const notification = (
  query?: Query<{
    darkTheme: 0 | 1
  }>
): Promise<any> => requestJSONAPI(`/ajax/notification`, query)

export const rpcNotifyCount = (
  query?: Query<{
    op: string | 'count_unread'
  }>
): Promise<{
  popboard: number
}> => requestJSON(`/rpc/notify_count.php`, query)

export const mypixivLatest = (
  type: 'manga' | 'novel',
  query?: Query<{
    p: number
  }>
): Promise<any> => requestJSONAPI(`/ajax/mypixiv_latest/${type}`, query)

export const novel = (id: number): Promise<any> => requestJSONAPI(`/ajax/novel/${id}`)

export const novelsLike = (data: { novel_id: string }): Promise<any> =>
  requestJSONAPI(`/ajax/novels/like`, undefined, data)

export const novelRpcMarker = (data: {
  mode: 'save'
  i_id: string
  u_id: string
  page: string
}): Promise<any> => requestJSON(`/novel/rpc_marker.php`, undefined, data)

export const novelRecommendInit = (
  id: number,
  query: {
    limit?: number
  }
): Promise<any> => requestJSONAPI(`/ajax/novel/${id}/recommend/init`, query)

export const novelRecommendIllusts = (query: { novel_ids: number[] }): Promise<any> =>
  requestJSONAPI(`/ajax/novel/recommend/illusts`, query)

export const novelsBookmarksAdd = (data: {
  illust_id: `${number}`
  restrict: 0 | 1
  comment: string
  tags: string[]
}): Promise<any> => requestJSONAPI(`/ajax/novels/bookmarks/add`, undefined, data)

export const novelsBookmarksDelete = (data: {
  book_id: `${number}`
  del: '1'
}): Promise<any> => requestJSONAPI(`/ajax/novels/bookmarks/delete`, undefined, data)

export const novelsBookmarksRemove = (data: { bookmark_ids: number[] }): Promise<any> =>
  requestJSONAPI(`/ajax/novels/bookmarks/remove`, undefined, data)

export const novelsBookmarksEditRestrict = (data: {
  bookmark_ids: number[]
  bookmark_restrict: 'private' | 'public'
}): Promise<any> => requestJSONAPI(`/ajax/novels/bookmarks/edit_restrict`, undefined, data)

export const novelsBookmarkAddTags = (data: {
  bookmark_ids: number[]
  tags: string[]
}): Promise<any> => requestJSONAPI(`/ajax/novels/bookmarks/add_tags`, undefined, data)

export const novelsCommentsRoots = (
  query: Query<{
    novel_id: number
    limit: number
    offset: number
  }>
): Promise<any> => requestJSONAPI(`/ajax/novels/comments/roots`, query)

export const novelsCommentsReplies = (query: { comment_id: number; page: number }): Promise<any> =>
  requestJSONAPI(`/ajax/novels/comments/replies`, query)

export const novelRpcPostComment = (data: {
  novel_id: number
  author_user_id: number
  comment: string
  type: 'comment' | 'stamp'
}): Promise<any> => requestJSONAPI(`/novel/rpc/post_comment.php`, undefined, data, 'form')

export const novelRpcDeleteComment = (data: { i_id: number; del_id: number }): Promise<any> =>
  requestJSONAPI(`/novel/rpc_delete_comment.php`, undefined, data, 'form')

export const novelSeries = (id: number): Promise<any> => requestJSONAPI(`/ajax/novel/series/${id}`)

export const novelSeriesContent = (
  id: number,
  query?: {
    limit?: number
    last_order?: number
    order_by?: 'asc' | 'dsc' | string
    page?: number
    size?: number
  }
): Promise<any> => requestJSONAPI(`/ajax/novel/series_content/${id}`, query)

export const novelSeriesContentTitles = (
  id: number
): Promise<
  {
    available: Boolean
    id: string
    title: string
  }[]
> => requestJSONAPI(`/ajax/novel/series/${id}/content_titles`)

export const novelSeriesWatch = (id: number): Promise<any> =>
  requestJSONAPI(`/ajax/novel/series/${id}/watch`, undefined, {})

export const novelSeriesUnatch = (id: number): Promise<any> =>
  requestJSONAPI(`/ajax/novel/series/${id}/unwatch`, undefined, {})

export const novelSeriesWatchlistNotificationTurnOn = (id: number): Promise<any> =>
  requestJSONAPI(`/ajax/novel/series/${id}/watchlist/notification/turn_on`, undefined, {})

export const novelSeriesWatchlistNotificationTurnOff = (id: number): Promise<any> =>
  requestJSONAPI(`/ajax/novel/series/${id}/watchlist/notification/turn_off`, undefined, {})

export const ranking = (query?: {
  mode?:
    | 'all'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'rookie'
    | 'original'
    | 'daily_ai'
    | 'male'
    | 'female'
    | 'daily_r18'
    | 'weekly_r18'
    | 'male_r18'
    | 'female_r18'
    | 'r18g'
  content?: 'all' | 'illust' | 'manga' | 'ugoira'
  date?: string
  ref?: string
  p?: number
}): Promise<any> => requestJSON('/ranking.php?format=json', query)

export const rpcCps = (
  query: Query<{
    keyword: string
  }>
): Promise<{
  candidates: Array<{
    access_count: string
    tag_name: string
    tag_translation: string
    type: string
  }>
}> => requestJSON(`/rpc/cps.php`, query)

export const searchSuggestion = (): Promise<any> => requestJSONAPI(`/ajax/search/suggestion?mode=all`)

export const search = (
  type: 'artworks' | 'tags' | 'top' | 'illustrations' | 'manga' | 'novels',
  keyword: string,
  query?: QuerySearch
): Promise<any> => requestJSONAPI(`/ajax/search/${type}/${encodeURIComponent(keyword)}`, query)

type QuerySearch = {
  page: number
  mode: 'all' | 'safe' | 'r18'
  order: string | 'date_d' | 'date'
  s_mode?: 's_tag' | 's_tag_only' | 's_tag_full' | 's_tc'
  ai_type?: 1
  wlt?: string
  wgt?: string
  hlt?: string
  hgt?: string
  ratio: number | 0 | 0.5 | -0.5
  tool: string
  scd: string
  ecd: string
  type?: string | 'all' | 'illust_and_ugoira' | 'illust' | 'manga' | 'ugoira'
  work_lang: string | 'zh-cn' | 'ja' | 'en' | 'zh-tw'
  gs: 0 | 1
} & Record<string, any>

export const series = (
  id: number,
  query?: {
    p: number
  }
): Promise<any> => requestJSONAPI(`/ajax/series/${id}`, query)

export const tagInfo = (
  query: Query<{
    tag: string
  }>
): Promise<{
  tag: string
  abstract: string
  thumbnail: string
  en: any
  en_new: any
  ja: any
  ja_new: any
  is_view_lead_wire: boolean
}> => requestJSONAPI(`/ajax/tag/info`, query)

export const tagsIllustAdd = (
  id: number,
  data: {
    tag: string
  }
): Promise<any> => requestJSONAPI(`/ajax/tags/illust/${id}/add`, undefined, data)

export const tagsSuggestByWord = (
  query: Query<{
    word: string
  }>
): Promise<
  {
    illust_count: number
    tag_name: string
    total_count: number
  }[]
> => requestJSONAPI(`/ajax/tags/suggest_by_word`, query)

export const top = (
  type: 'illust' | 'manga' | 'novel',
  query?: Query<{
    mode?: 'all' | string
  }>
): Promise<any> => requestJSONAPI(`/ajax/top/${type}`, query)

export const user = (
  id: number,
  query?: Query<{
    full?: 0 | 1
  }>
): Promise<any> => requestJSONAPI(`/ajax/user/${id}`, query)

export const userWorksLatest = (id: number, query?: Query): Promise<any> =>
  requestJSONAPI(`/ajax/user/${id}/works/latest`, query)

export const userFollowing = (
  id: number,
  query: {
    offset: number
    limit: number
    rest: 'show' | 'hide'
  }
): Promise<any> => requestJSONAPI(`/ajax/user/${id}/following`, query)

export const userBookmarkAdd = (data: {
  user_id: number
  tag: string
  restrict: '0' | '1'
}): Promise<[]> =>
  requestJSON('/bookmark_add.php?format=json&type=user&mode=add', undefined, data, 'form')

export const userRecommends = (
  id: number,
  query?: {
    userNum: number
    workNum: number
    isR18: 'true' | 'false'
  }
): Promise<any> => requestJSONAPI(`/ajax/user/${id}/recommends`, query)

export const rpcGroupSetting = (data: {
  mode: 'del'
  type: 'bookuser'
  id: number
}): Promise<{
  type: string
  user_id: string
}> => requestJSON(`/rpc_group_setting.php`, undefined, data, 'form')

export const userExtra = (query?: Query): Promise<{
  background: string | null
  followers: number
  following: number
  mypixivCount: number
}> => requestJSONAPI(`/ajax/user/extra`, query)

export const rpc = (
  data: Query<
    | {
        mode: 'following_user_restrict_change'
        user_id: string
        restrict: 0 | 1
      }
    | {
        mode: 'message_thread_unread_count'
      }
    | {
        mode: 'latest_message_threads2'
        num: number
      }
  >
): Promise<any> => requestJSONAPI(`/rpc/index.php`, undefined, data)

export const userProfile = (
  id: number,
  type: 'all' | 'top' | 'illusts' | 'novels',
  query?: Query<{
    ids: number[]
  }>
): Promise<any> => requestJSONAPI(`/ajax/user/${id}/profile/${type}`, query)

export const userIllustsBookmarks = (
  id: number,
  query: {
    tag: string
    offset: number
    limit: number
    rest: 'hide' | 'show'
  }
): Promise<any> => requestJSONAPI(`/ajax/user/${id}/illusts/bookmarks`, query)

export const userIllustsBookMarkTags = (id: number, query?: Query): Promise<any> =>
  requestJSONAPI(`/ajax/user/${id}/illusts/bookmark/tags`, query)

export const userNovelsBookmarks = (
  id: number,
  query: {
    tag: string
    offset: number
    limit: number
    rest: 'hide' | 'show'
  }
): Promise<any> => requestJSONAPI(`/ajax/user/${id}/novels/bookmarks`, query)

export const userNovelsBookMarkTags = (id: number, query?: Query): Promise<any> =>
  requestJSONAPI(`/ajax/user/${id}/novels/bookmark/tags`, query)

export const userTag = (id: number, type: 'illusts' | 'manga' | 'novels'): Promise<any> =>
  requestJSONAPI(`/ajax/user/${id}/${type}/tag`)

export const userTags = (
  id: number,
  type: 'illusts' | 'manga' | 'novels',
  query: {
    tag: string
    offset: number
    limit: number
  }
): Promise<any> => requestJSONAPI(`/ajax/user/${id}/${type}/tag`, query)

export const watchList = (
  type: 'manga' | 'novel',
  query?: Query<{
    p: number
  }>
): Promise<any> => requestJSONAPI(`/ajax/watch_list/${type}`, query)

// ---------------------------------------------------------------------------
// Read-only (GET) functions ported from `reference/pixiv-web-api/src/api/*.ts`.
// Every body passes only the endpoint (+ optional query) — never a data payload,
// so `request()` always issues GET. No CSRF handling: write/POST endpoints are
// deliberately not ported (they would 403 without a csrfToken).
// ---------------------------------------------------------------------------

export const blockList = (query: Query<{ target_id: number; offset: number; limit: number }>) =>
  requestJSONAPI<{
    block_items: Array<{
      userId: string
      label: string
      iconUrl: string
      enabled: boolean
      isBlocked: boolean
      isTarget: boolean
    }>
    has_more_blocks: boolean
  }>(`/ajax/block/list`, query)

export const collectionsCreationPermissionStatus = (query?: Query) =>
  requestJSONAPI<{ status: string }>(`/ajax/collections/creation_permission_status`, query)

export const discoveryArtworks = (
  query: Query<{
    mode: 'all' | 'safe' | 'r18'
    limit: number
  }>
) =>
  requestJSONAPI<{
    tagTranslation: TagTranslation
    thumbnails: Thumbnails
    illustSeries: any[]
    requests: RequestItem[]
    users: UserItem[]
    recommendedIllusts: Array<{
      illustId: string
      recommendMethods: string[]
      recommendScore: number
      recommendSeedIllustIds: string[]
    }>
  }>(`/ajax/discovery/artworks`, query)

export const discoveryArtworksMeta = (query: Query<{ mode: 'all' | 'safe' | 'r18' }>) =>
  requestJSONAPI<{
    zoneConfig: ZoneConfig
    meta: { title: string; description: string | false }
  }>(`/ajax/discovery/artworks/meta`, query)

export const discoveryNovels = (
  query: Query<{
    mode: 'all' | 'safe' | 'r18'
    limit: number
  }>
) =>
  requestJSONAPI<{
    tagTranslation: TagTranslation
    thumbnails: Thumbnails
    illustSeries: any[]
    requests: RequestItem[]
    users: UserItem[]
    recommendedNovelIds: string[]
    recommendNovelDetails: Record<
      string,
      {
        methods: string[]
        score: number
        seed_novel_ids: number[]
        seed_illust_ids: string[]
        position: number
      }
    >
  }>(`/ajax/discovery/novels`, query)

export const discoveryNovelsMeta = (query: Query<{ mode: 'all' | 'safe' | 'r18' }>) =>
  requestJSONAPI<{
    zoneConfig: ZoneConfig
    meta: { title: string; description: string | false }
  }>(`/ajax/discovery/novels/meta`, query)

export const discoveryUsers = (
  query: Query<{
    mode: 'all' | 'safe' | 'r18'
    limit: number
  }>
) =>
  requestJSONAPI<{
    tagTranslation: TagTranslation
    thumbnails: Thumbnails
    illustSeries: any[]
    requests: RequestItem[]
    users: UserItem[]
    recommendedUsers: Array<{
      userId: string
      recentIllustIds: string[]
      recentNovelIds: string[]
    }>
  }>(`/ajax/discovery/users`, query)

export const enquete = (query?: Query) => requestJSONAPI<[]>(`/ajax/enquete`, query)

export const followingUserDetails = (query: Query<{ user_id: number }>) =>
  requestJSONAPI<{
    user_id: number
    user_name: string
    restrict: `${number}`
    tags: string[]
  }>(`/ajax/following/user/details`, query)

export const genreNovel = (
  genre:
    | 'all'
    | 'romance'
    | 'isekai_fantasy'
    | 'contemporary_fantasy'
    | 'mystery'
    | 'horror'
    | 'sci-fi'
    | 'literature'
    | 'drama'
    | 'historical_pieces'
    | 'bl'
    | 'yuri'
    | 'for_kids'
    | 'poetry'
    | 'non-fiction'
    | 'screenplays'
    | 'reviews'
    | 'other',
  query?: Query<{ mode?: 'safe' | 'r18' | string }>
) =>
  requestJSONAPI<{
    page: {
      pickupDate: string
      pickupSeriesIds: `${number}`[]
      popularSeriesIds: `${number}`[]
      genrePageGender: string
    }
    tagTranslation: TagTranslation
    thumbnails: Thumbnails
    illustSeries: any[]
    requests: RequestItem[]
    users: UserItem[]
    zoneConfig: ZoneConfig
    extraData: ExtraData
  }>(`/ajax/genre/novel/${genre}`, query)

export const illustsBookmarksRenameTagProgress = (query?: Query) =>
  requestJSONAPI<{ isInProgress: boolean }>(`/ajax/illusts/bookmarks/rename_tag_progress`, query)

export const messageCanSend = (userId: number, query?: Query) =>
  requestJSONAPI<{ can_send: boolean }>(`/ajax/message/can_send/${userId}`, query)

export const muteItems = (query: Query<{ context: 'user'; id: number }>) =>
  requestJSONAPI<{
    mute_items: Array<{
      type: string
      value: string
      label: string
      iconUrl: string
      enabled: boolean
      isMuted: boolean
      listType: string
    }>
  }>(`/ajax/mute/items`, query)

export const novelEditorsPicks = (
  query: Query<{
    limit?: number
    date?: string
  }>
) =>
  requestJSONAPI<{
    tagTranslation: TagTranslation
    thumbnails: Thumbnails
    illustSeries: any[]
    requests: RequestItem[]
    users: UserItem[]
    page: { ids: string[] }
  }>(`/ajax/novel/editors_picks`, query)

export const novelsBookmarksRenameTagProgress = (query?: Query) =>
  requestJSONAPI<{ isInProgress: boolean }>(`/ajax/novels/bookmarks/rename_tag_progress`, query)

export const settings = (query?: Query) =>
  requestJSONAPI<{
    notifications: any
    mail: any
    mailNotificationSuspended: boolean
    mailAddressNotificationResumeLink: any
    languages: any
    ads: any
    accountPortalLink: string
    messageFlag: number
    hideAiWorks: boolean
    readingStatusOptout: boolean
    location: any
    noEmailAuthorized: boolean
    optoutRenewal: any
    zoneConfig: any
    allowCitationUser: boolean
    collectionCitedCount: number
  }>(`/ajax/settings`, query)

export const settingsSelf = (query?: Query) =>
  requestJSONAPI<{
    user_status: {
      user_id: string
      user_status: string
      user_account: string
      user_name: string
      user_premium: string
      user_birth: string
      user_x_restrict: string
      user_create_time: string
      user_mail_address: string
      profile_img: { main: string }
      profile_img_app_check_status: number
      profile_img_mask_rule_set: any
      age: number
      is_logged_in: boolean
      stamp_series: any[]
    }
  }>(`/ajax/settings/self`, query)

export const sketchLiveFollowing = () => requestJSONAPI<[]>(`/ajax/sketch/live/following`)

export const storiesTagStories = (query: Query<{ tag: string }>) =>
  requestJSONAPI<{ tagStoryIds: string[] }>(`/ajax/stories/tag_stories`, query)

export const streetForYou = (query?: Query) =>
  requestJSONAPI<{
    contents: any[]
    access: any
  }>(`/ajax/street/for_you`, query)

export const streetLatest = (query?: Query) =>
  requestJSONAPI<{
    content: any
  }>(`/ajax/street/latest`, query)

export const streetRecommendTags = (query?: Query) =>
  requestJSONAPI<{
    content: {
      kind: string
      thumbnails: any[]
      tags: Array<{ name: string; translatedName: string | null; isEmphasized: boolean }>
    }
  }>(`/ajax/street/recommend_tags`, query)

export const streetSub = (query?: Query) =>
  requestJSONAPI<{
    contents: any[]
  }>(`/ajax/street/sub`, query)

export const tagsFrequentIllust = (query: Query<{ ids: number[] }>) =>
  requestJSONAPI<Array<{ tag: string; tag_translation: string }>>(`/ajax/tags/frequent/illust`, query)

export const tagsFrequentNovel = (query: Query<{ ids: number[] }>) =>
  requestJSONAPI<Array<{ tag: string; tag_translation: string }>>(`/ajax/tags/frequent/novel`, query)

export const topWatchlist = (type: 'novel', query?: Query<{ mode?: 'all' | string }>) =>
  requestJSONAPI<{
    page: { watchedSeriesIds: number[] }
    novelSeries: NovelSeriesItem[]
  }>(`/ajax/top/${type}/watchlist`, query)

export const userBookmarkTags = (id: number, type: 'illusts' | 'novels', query?: Query) =>
  requestJSONAPI<{
    public: Array<{ tag: string; cnt: number }>
    private: Array<{ tag: string; cnt: number }>
    tooManyBookmark: boolean
    tooManyBookmarkTags: boolean
  }>(`/ajax/user/${id}/${type}/bookmark/tags`, query)

export const userBookmarks = (
  id: number,
  type: 'illusts',
  query: {
    tag: string
    offset: number
    limit: number
    rest: 'hide' | 'show'
  }
) =>
  requestJSONAPI<{
    works: IllustItem[]
    total: number
    zoneConfig: ZoneConfig
    extraData: ExtraData
  }>(`/ajax/user/${id}/${type}/bookmarks`, query)

export const userBookmarksNovels = (
  id: number,
  query: { tag: string; offset: number; limit: number; rest: 'hide' | 'show' }
) =>
  requestJSONAPI<{
    works: NovelItem[]
    total: number
    zoneConfig: ZoneConfig
    extraData: ExtraData
  }>(`/ajax/user/${id}/novels/bookmarks`, query)

export const userCollectionsBookmarks = (
  id: number,
  query: Query<{ offset: number; limit: number; rest: 'show' | 'hide' }>
) =>
  requestJSONAPI<{
    tagTranslation: TagTranslation
    thumbnails: Thumbnails
    illustSeries: any[]
    requests: RequestItem[]
    users: UserItem[]
    works: IllustItem[]
    total: number
    extraData: ExtraData
  }>(`/ajax/user/${id}/collections/bookmarks`, query)

export const userEventPortalNovels = (query?: Query<{ mode?: 'all' | string; p?: number }>) =>
  requestJSONAPI<{
    tagTranslation: TagTranslation
    thumbnails: Thumbnails
    illustSeries: any[]
    requests: RequestItem[]
    users: UserItem[]
    page: any
  }>(`/ajax/user_event/portal/novels`, query)

export const userIllusts = (id: number, query: Query<{ ids: number[] }>) =>
  requestJSONAPI<Record<string, IllustItem>>(`/ajax/user/${id}/illusts`, query)

export const userMeta = (id: number, query?: Query) =>
  requestJSONAPI<ExtraData['meta']>(`/ajax/user/${id}/meta`, query)

export const userNovels = (id: number, query: Query<{ ids: number[] }>) =>
  requestJSONAPI<Record<string, NovelItem>>(`/ajax/user/${id}/novels`, query)

export const userTagNovels = (
  id: number,
  query: { tag: string; offset: number; limit: number }
) =>
  requestJSONAPI<{
    works: NovelItem[]
    total: number
    zoneConfig: ZoneConfig
    extraData: ExtraData
  }>(`/ajax/user/${id}/novels/tag`, query)

export const userTutorial = (id: number, query?: Query) =>
  requestJSONAPI<{ status: boolean }>(`/ajax/user/tutorial/${id}`, query)

export const webpush = (query?: Query) => requestJSONAPI<{ permission: string }>(`/ajax/webpush`, query)

// ---------------------------------------------------------------------------
// Types ported from `reference/pixiv-web-api/src/types.ts` — only the ones the
// functions above actually reference.
// ---------------------------------------------------------------------------

export interface IllustItem {
  id: string
  title: string
  illustType: 0 | 1 | 2
  xRestrict: 0 | 1 | 2
  restrict: number
  sl: number
  url: string
  description: string
  tags: string[]
  userId: string
  userName: string
  width: number
  height: number
  pageCount: number
  isBookmarkable: boolean
  bookmarkData: { id: string; private: boolean } | null
  alt: string
  titleCaptionTranslation: {
    workTitle: string | null
    workCaption: string | null
  } | null
  createDate: string
  updateDate: string
  isUnlisted: boolean
  isMasked: boolean
  aiType: number
  profileImageUrl: string
}

export interface NovelItem {
  id: string
  title: string
  genre: string
  xRestrict: 0 | 1 | 2
  restrict: number
  url: string
  tags: string[]
  userId: string
  userName: string
  profileImageUrl: string
  textCount: number
  wordCount: number
  readingTime: number
  useWordCount: boolean
  description: string
  isBookmarkable: boolean
  bookmarkData: { id: string; private: boolean } | null
  bookmarkCount: number
  isOriginal: boolean
  marker: any | null
  titleCaptionTranslation: {
    workTitle: string | null
    workCaption: string | null
  } | null
  createDate: string
  updateDate: string
  isMasked: boolean
  aiType: number
  seriesId: string | null
  seriesTitle: string | null
  seriesContentOrder: number | null
  isUnlisted: boolean
  visibilityScope: number
  language: string
}

export interface NovelSeriesItem {
  id: string
  title: string
  titleCaptionTranslation: {
    workTitle: string | null
    workCaption: string | null
  } | null
  cover: any
  tags: string[]
  xRestrict: 0 | 1 | 2
  isOriginal: boolean
  genre: string
  createDateTime: string
  updateDateTime: string
  userId: string
  userName: string
  profileImageUrl: string
  bookmarkCount: number
  isOneshot: boolean
  caption: string
  isConcluded: boolean
  episodeCount: number
  publishedEpisodeCount: number
  latestPublishDateTime: string
  latestEpisodeId: string
  isWatched: boolean
  isNotifying: boolean
  restrict: number
  textLength: number
  wordCount: number
  readingTime: number
  publishedTextLength: number
  publishedWordCount: number
  publishedReadingTime: number
  useWordCount: boolean
  aiType: number
}

export interface RequestItem {
  requestId: string
  planId: string
  fanUserId: string
  creatorUserId: string
  requestStatus: string
  requestPostWorkType: string
  requestPrice: number
  requestProposal: any
  requestTags: string[]
  requestAdultFlg: boolean
  requestAnonymousFlg: boolean
  requestRestrictFlg: boolean
  requestAcceptCollaborateFlg: boolean
  requestResponseDeadlineDatetime: string | null
  requestPostDeadlineDatetime: string | null
  role: string
  plan: any
  collaborateStatus: any
  giftFile: any
  postWork: any
  notifyBadge: any
  fanbox: any
  requestResend: any
}

export interface Thumbnails {
  illust: IllustItem[]
  novel: NovelItem[]
  novelSeries: NovelSeriesItem[]
  novelDraft: any[]
  collection: any[]
}

export interface UserItem {
  partial: number
  comment: string
  followedBack: boolean
  userId: string
  name: string
  image: string
  imageBig: string
  premium: boolean
  isFollowed: boolean
  isMypixiv: boolean
  isBlocking: boolean
  background: string | null
  commission: any | null
}

export type TagTranslation = Record<
  string,
  {
    en?: string
    ko?: string
    zh?: string
    zh_tw?: string
    romaji?: string
  }
>

export interface ZoneConfig {
  [key: string]: { url: string }
}

export interface ExtraMeta {
  title: string
  description: string
  canonical?: string
  alternateLanguages?: Record<string, string>
  descriptionHeader?: string | null
  ogp: {
    description: string
    image?: string
    title: string
    type: string
  }
  twitter: {
    description: string
    image?: string
    title: string
    card: string
    site?: string
  }
}

export interface ExtraData {
  meta: ExtraMeta
}
