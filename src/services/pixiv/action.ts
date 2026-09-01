// deno-lint-ignore-file require-await
import PixivApi from '@lib/pixiv-api.ts'

const pixiv = new PixivApi()

export const pixivActionMap: Record<string, [fn: any, expire?: number]> = {
  illust: [
    async (req: any) => {
      return pixiv.illustDetail(req.query.id)
    },
    60 * 60 * 24 * 7,
  ],
  member: [
    async (req: any) => {
      return pixiv.userDetail(req.query.id)
    },
    60 * 60 * 24,
  ],
  illust_recommended: [
    async (req: any) => {
      return pixiv.illustRecommended({
        include_privacy_policy: false,
        include_ranking_illusts: false,
        ...req.query,
      })
    },
    60 * 60 * 12,
  ],
  user_recommended: [
    async (req: any) => {
      return pixiv.userRecommended({
        ...req.query,
      })
    },
    60 * 60 * 12,
  ],
  illust_new: [
    async (req: any) => {
      return pixiv.illustNew({
        content_type: 'illust',
        ...req.query,
      })
    },
    60 * 10,
  ],
  manga_new: [
    async (req: any) => {
      return pixiv.mangaNew({
        ...req.query,
      })
    },
    60 * 10,
  ],
  novel_new: [
    async (req: any) => {
      return pixiv.novelNew({
        ...req.query,
      })
    },
    60 * 10,
  ],
  search_autocomplete: [
    async (req: any) => {
      return pixiv.searchAutoCompleteV2(req.query.word)
    },
    60 * 60 * 72,
  ],
  popular_preview: [
    async (req: any) => {
      return pixiv.searchIllustPopularPreview(req.query.word, {
        include_translated_tag_results: 'true',
        merge_plain_keyword_results: 'true',
        search_target: 'partial_match_for_tags',
        ...req.query,
      })
    },
    60 * 60 * 72,
  ],
  popular_preview_novel: [
    async (req: any) => {
      return pixiv.searchNovelPopularPreview(req.query.word, {
        include_translated_tag_results: 'true',
        merge_plain_keyword_results: 'true',
        search_target: 'partial_match_for_tags',
        ...req.query,
      })
    },
    60 * 60 * 72,
  ],
  search_user: [
    async (req: any) => {
      const { word, page = 1, size = 30 } = req.query
      return pixiv.searchUser(word, {
        offset: (page - 1) * size,
      })
    },
    60 * 60 * 24,
  ],
  member_illust: [
    async (req: any) => {
      const { id, illust_type = 'illust', page = 1, size = 30 } = req.query
      return pixiv.userIllusts(id, {
        type: illust_type,
        offset: (page - 1) * size,
      })
    },
    60 * 60 * 6,
  ],
  member_novel: [
    async (req: any) => {
      const { id, page = 1, size = 30 } = req.query
      return pixiv.userNovels(id, {
        offset: (page - 1) * size,
      })
    },
    60 * 60 * 6,
  ],
  favorite: [
    async (req: any) => {
      const { id, ...opts } = req.query
      if (opts.max_bookmark_id == 0) delete opts.max_bookmark_id
      return pixiv.userBookmarksIllust(id, opts)
    },
    60 * 60 * 12,
  ],
  favorite_novel: [
    async (req: any) => {
      const { id, ...opts } = req.query
      return pixiv.userBookmarksNovel(id, opts)
    },
    60 * 60 * 12,
  ],
  follower: [
    async (req: any) => {
      const { id, page = 1, size = 30 } = req.query
      return pixiv.userFollower(id, {
        offset: (page - 1) * size,
      })
    },
    60 * 60 * 1,
  ],
  following: [
    async (req: any) => {
      const { id, page = 1, size = 30 } = req.query
      return pixiv.userFollowing(id, {
        offset: (page - 1) * size,
      })
    },
    60 * 10,
  ],
  rank: [
    async (req: any) => {
      const { page = 1, size = 30, ...opts } = req.query
      return pixiv.illustRanking({
        offset: (page - 1) * size,
        ...opts,
      })
    },
    60 * 60 * 24 * 14,
  ],
  rank_novel: [
    async (req: any) => {
      const { page = 1, size = 30, ...opts } = req.query
      return pixiv.novelRanking({
        offset: (page - 1) * size,
        ...opts,
      })
    },
    60 * 60 * 24 * 14,
  ],
  search: [
    async (req: any) => {
      const { word, page = 1, size = 30, mode = 'partial_match_for_tags', order = 'date_desc', ...opts } = req.query
      return pixiv.searchIllust(word, {
        offset: (page - 1) * size,
        include_translated_tag_results: true,
        merge_plain_keyword_results: true,
        search_target: mode,
        sort: order,
        ...opts,
      })
    },
    60 * 60 * 1,
  ],
  search_novel: [
    async (req: any) => {
      const { word, page = 1, size = 30, mode = 'partial_match_for_tags', sort = 'date_desc', ...opts } = req.query
      return pixiv.searchNovel(word, {
        offset: (page - 1) * size,
        include_translated_tag_results: true,
        merge_plain_keyword_results: true,
        search_target: mode,
        sort,
        ...opts,
      })
    },
    60 * 60 * 1,
  ],
  tags: [
    async (req: any) => {
      return pixiv.trendingTagsIllust(req.query)
    },
    60 * 60 * 12,
  ],
  tags_novel: [
    async (req: any) => {
      return pixiv.trendingTagsNovel(req.query)
    },
    60 * 60 * 12,
  ],
  related: [
    async (req: any) => {
      const { page = 1, size = 30, id, nextUrl } = req.query
      return pixiv.illustRelated(id, {
        offset: (page - 1) * size,
        nextUrl,
      })
    },
    60 * 60 * 72,
  ],
  related_novel: [
    async (req: any) => {
      const { page = 1, size = 30, id } = req.query
      return pixiv.novelRelated(id, {
        offset: (page - 1) * size,
      })
    },
    60 * 60 * 72,
  ],
  related_member: [
    async (req: any) => {
      const { id } = req.query
      return pixiv.userRelated(id)
    },
    60 * 60 * 72,
  ],
  ugoira_metadata: [
    async (req: any) => {
      const { id } = req.query
      return pixiv.ugoiraMetaData(id)
    },
    60 * 60 * 24 * 7,
  ],
  illust_comments: [
    async (req: any) => {
      const { page = 1, size = 30, id } = req.query
      return pixiv.illustCommentsV3(id, {
        offset: (page - 1) * size,
      })
    },
    60 * 10,
  ],
  novel_comments: [
    async (req: any) => {
      const { page = 1, size = 30, id } = req.query
      return pixiv.novelCommentsV3(id, {
        offset: (page - 1) * size,
      })
    },
    60 * 10,
  ],
  illust_comment_replies: [
    async (req: any) => {
      const { id } = req.query
      return pixiv.illustCommentReplies(id)
    },
    60 * 10,
  ],
  novel_comment_replies: [
    async (req: any) => {
      const { id } = req.query
      return pixiv.novelCommentReplies(id)
    },
    60 * 10,
  ],
  manga_recommended: [
    async (req: any) => {
      return pixiv.mangaRecommended(req.query)
    },
    60 * 60 * 12,
  ],
  novel_recommended: [
    async (req: any) => {
      return pixiv.novelRecommended(req.query)
    },
    60 * 60 * 12,
  ],
  novel_series: [
    async (req: any) => {
      const { page = 1, size = 30, id } = req.query
      return pixiv.novelSeries(id, {
        last_order: (page - 1) * size,
      })
    },
    60 * 60 * 24,
  ],
  illust_series: [
    async (req: any) => {
      const { page = 1, size = 30, id } = req.query
      return pixiv.illustSeries(id, {
        offset: (page - 1) * size,
      })
    },
    60 * 60 * 24,
  ],
  member_illust_series: [
    async (req: any) => {
      const { page = 1, size = 30, id } = req.query
      return pixiv.userIllustSeries(id, {
        offset: (page - 1) * size,
      })
    },
    60 * 60 * 24,
  ],
  member_novel_series: [
    async (req: any) => {
      const { page = 1, size = 30, id } = req.query
      return pixiv.userNovelSeries(id, {
        offset: (page - 1) * size,
      })
    },
    60 * 60 * 24,
  ],
  novel_detail: [
    async (req: any) => {
      const { id } = req.query
      return pixiv.novelDetail(id)
    },
    60 * 60 * 24,
  ],
  novel_text: [
    async (req: any) => {
      const { id } = req.query
      return pixiv.novelText(id)
    },
    60 * 60 * 24,
  ],
  webview_novel: [
    async (req: any) => {
      const { id, raw } = req.query
      return pixiv.webviewNovel(id, raw == 'true')
    },
    60 * 60 * 24,
  ],
  live_list: [
    async (req: any) => {
      const { page = 1, size = 30 } = req.query
      const params = page > 1 ? { offset: (page - 1) * size } : {}
      return pixiv.liveList(params)
    },
    60,
  ],
  spotlights: [
    async (req: any) => {
      const { page = 1, size = 10, ...opts } = req.query
      return pixiv.spotlights({
        offset: (page - 1) * size,
        ...opts,
      })
    },
    60 * 60 * 12,
  ],
}

export const pixivActionKeys = Object.keys(pixivActionMap)

export async function callPixivAction(key: string, query: Record<string, string>) {
  const act = pixivActionMap[key]
  if (!act) return null

  const [fn, expire] = act
  const data = await fn({ query })
  const maxAge = data?.next_url === null && data?.illusts?.length === 0 ? 0 : expire

  return { data, maxAge }
}

let refreshPromise: Promise<void> | null = null
async function refreshPixivToken() {
  if (!refreshPromise) {
    refreshPromise = pixiv
      .switchRefreshToken()
      .catch(() => {})
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export async function withPixivRefresh<T>(fn: () => Promise<T>) {
  let retried = false
  while (true) {
    try {
      return await fn()
    } catch (err: any) {
      const errmsg = err?.cause?.error?.message || err?.message || err
      const needRefresh = errmsg === 'Rate Limit' || errmsg?.includes?.('invalid_grant')
      if (!retried && needRefresh) {
        retried = true
        await refreshPixivToken()
        continue
      }
      throw err
    }
  }
}
