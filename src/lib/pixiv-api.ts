/*
https://github.com/alphasp/pixiv-api-client

MIT License

Copyright (c) 2016 alphasp <gmerudotcom@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import AwaitLock from 'await-lock'
// @ts-types="npm:@types/crypto-js"
import CryptoJS from 'crypto-js'
// @ts-types="npm:@types/qs"
import qs from 'qs'
import dayjs from 'dayjs'
import { memdb } from '@lib/db-memory.ts'
import { PIXIV_ACCOUNT_TOKEN, PIXIV_ACCOUNT_TOKEN_ALTS, PIXIV_API_HEADERS } from './const.ts'

const md5 = (s: string) => CryptoJS.MD5(s).toString()

const BASE_URL = 'https://app-api.pixiv.net'
const OAUTH_URL = 'https://oauth.secure.pixiv.net'
const CLIENT_ID = 'MOBrBDS8blbauoSck0ZfDbtuzpyT'
const CLIENT_SECRET = 'lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj'
const HASH_SECRET = '28c1fdd170a5204386cb1313c7077b34f83e4aaf4aa829ce78c231e05b0bae2c'

const DEFAULT_HEADERS = { ...PIXIV_API_HEADERS }

async function callApi(url: string, options: Record<string, any> = {}) {
  let finalUrl = /^https?:\/\//i.test(url) ? url : BASE_URL + url
  const query = options.params ? `${finalUrl.includes('?') ? '&' : '?'}${qs.stringify(options.params)}` : ''
  finalUrl += query
  if (options.data) options.body = options.data
  const resp = await fetch(finalUrl, options)
  if (resp.ok) {
    return options.responseType === 'text' ? resp.text() : resp.json()
  }
  const respText = await resp.text()
  if (respText.toLowerCase().includes('rate limit')) {
    throw new Error('Rate Limit')
  }
  let error
  try {
    error = new Error('call pixiv api error', { cause: JSON.parse(respText) })
  } catch (_) {
    error = new Error(respText)
  }
  throw error
}

const loginLock = new AwaitLock.default()

class PixivApi {
  token = PIXIV_ACCOUNT_TOKEN
  headers: Record<string, string>
  auth: Record<string, any> | null | undefined
  _expireTime = 0

  constructor(auth?: Record<string, any>) {
    this.headers = { ...DEFAULT_HEADERS }
    if (auth) this.auth = auth
  }

  get _loginExpired() {
    return Date.now() / 1000 > this._expireTime - 60
  }

  setLanguage(lang: string) {
    this.headers['Accept-Language'] = lang
  }

  getDefaultHeaders(): Record<string, string> {
    const datetime = dayjs().format()
    return Object.assign({}, this.headers, {
      'X-Client-Time': datetime,
      'X-Client-Hash': md5(`${datetime}${HASH_SECRET}`),
    })
  }

  async authInfo() {
    await this._login()
    return this.auth
  }

  logout() {
    this.auth = null
    delete this.headers.Authorization
    return Promise.resolve()
  }

  async _login() {
    if (!this._loginExpired) return
    await loginLock.acquireAsync()
    if (!this._loginExpired) {
      loginLock.release()
      return
    }
    try {
      const cacheKey = `PXV_CLIENT_AUTH_${this.token?.slice(0, 8)}`
      let auth = memdb.get<any>(cacheKey)
      if (auth) {
        console.log('[pixivApi._login] access_token cache hit')
        this.auth = auth
        this._expireTime = Date.now() / 1000 + auth.expires_in
      } else {
        auth = await this.refreshAccessToken(this.token)
        this._expireTime = Date.now() / 1000 + auth.expires_in
        memdb.set(cacheKey, auth, Number(auth.expires_in) * 0.8)
      }
    } finally {
      loginLock.release()
    }
  }

  _currentTokenIndex = 0
  async switchRefreshToken() {
    console.log('[pixivApi.switchRefreshToken] current token index: ', this._currentTokenIndex)
    this._currentTokenIndex += 1
    if (this._currentTokenIndex >= PIXIV_ACCOUNT_TOKEN_ALTS.length) this._currentTokenIndex = 0
    console.log('[pixivApi.switchRefreshToken] next token index: ', this._currentTokenIndex)
    this.token = PIXIV_ACCOUNT_TOKEN_ALTS[this._currentTokenIndex]
    this._expireTime = Date.now() / 1000
    await this._login()
  }

  async tokenRequest(code: any, code_verifier: any) {
    const data = qs.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      code_verifier,
      redirect_uri: `${BASE_URL}/web/v1/users/auth/pixiv/callback`,
      grant_type: 'authorization_code',
      include_policy: true,
    })
    const options = {
      method: 'POST',
      headers: Object.assign(this.getDefaultHeaders(), {
        'Content-Type': 'application/x-www-form-urlencoded',
      }),
      data,
    }
    const res = await callApi(`${OAUTH_URL}/auth/token`, options)
    this.auth = res.response
    return res.response
  }

  async refreshAccessToken(refreshToken?: string) {
    if (!this.auth?.refresh_token && !refreshToken) {
      return Promise.reject(new Error('[pixivApi.refreshAccessToken] refresh_token required'))
    }
    console.log('[pixivApi.refreshAccessToken] refreshing access_token...')
    const data = qs.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      get_secure_url: true,
      include_policy: true,
      grant_type: 'refresh_token',
      refresh_token: refreshToken || this.auth!.refresh_token,
    })
    const options = {
      method: 'POST',
      headers: Object.assign(this.getDefaultHeaders(), {
        'Content-Type': 'application/x-www-form-urlencoded',
      }),
      data,
    }
    const res = await callApi(`${OAUTH_URL}/auth/token`, options)
    this.auth = res.response
    console.log('[pixivApi.refreshAccessToken] refresh access_token ok.')
    return res.response
  }

  async requestUrl(url: string, options: Record<string, any> = {}) {
    if (!url) {
      return Promise.reject(new Error('url cannot be empty'))
    }
    await this._login()
    options.headers = Object.assign(this.getDefaultHeaders(), options.headers || {})
    if (this.auth?.access_token) {
      options.headers.Authorization = `Bearer ${this.auth.access_token}`
    }
    return callApi(url, options)
  }

  userState() {
    return this.requestUrl('/v1/user/me/state')
  }

  searchIllust(word: any, options: any) {
    if (!word) {
      return Promise.reject(new Error('word required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          word,
          search_target: 'partial_match_for_tags',
          sort: 'date_desc',
        },
        options
      )
    )
    return this.requestUrl(`/v1/search/illust?${queryString}`)
  }

  searchIllustPopularPreview(word: any, options: any) {
    if (!word) {
      return Promise.reject(new Error('word required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          word,
          search_target: 'partial_match_for_tags',
        },
        options
      )
    )
    return this.requestUrl(`/v1/search/popular-preview/illust?${queryString}`)
  }

  searchNovel(word: any, options: any) {
    if (!word) {
      return Promise.reject(new Error('word required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          word,
          search_target: 'partial_match_for_tags',
          sort: 'date_desc',
        },
        options
      )
    )
    return this.requestUrl(`/v1/search/novel?${queryString}`)
  }

  searchNovelPopularPreview(word: any, options: any) {
    if (!word) {
      return Promise.reject(new Error('word required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          word,
          search_target: 'partial_match_for_tags',
        },
        options
      )
    )
    return this.requestUrl(`/v1/search/popular-preview/novel?${queryString}`)
  }

  searchIllustBookmarkRanges(word: any, options: any) {
    if (!word) {
      return Promise.reject(new Error('word required'))
    }
    const queryString = qs.stringify(
      Object.assign(
        {
          word,
          search_target: 'partial_match_for_tags',
        },
        options
      )
    )
    return this.requestUrl(`/v1/search/bookmark-ranges/illust?${queryString}`)
  }

  searchNovelBookmarkRanges(word: any, options: any) {
    if (!word) {
      return Promise.reject(new Error('word required'))
    }
    const queryString = qs.stringify(
      Object.assign(
        {
          word,
          search_target: 'partial_match_for_tags',
        },
        options
      )
    )
    return this.requestUrl(`/v1/search/bookmark-ranges/novel?${queryString}`)
  }

  searchUser(word: any, options: any) {
    if (!word) {
      return Promise.reject(new Error('word required'))
    }
    const queryString = qs.stringify(
      Object.assign(
        {
          word,
        },
        options
      )
    )
    return this.requestUrl(`/v1/search/user?${queryString}`)
  }

  searchAutoComplete(word: any) {
    if (!word) {
      return Promise.reject(new Error('word required'))
    }
    const queryString = qs.stringify(
      Object.assign({
        word,
      })
    )
    return this.requestUrl(`/v1/search/autocomplete?${queryString}`)
  }

  searchAutoCompleteV2(word: any) {
    if (!word) {
      return Promise.reject(new Error('word required'))
    }
    const queryString = qs.stringify(
      Object.assign({
        word,
      })
    )
    return this.requestUrl(`/v2/search/autocomplete?${queryString}`)
  }

  userDetail(id: any, options: Record<string, any> = {}) {
    if (!id) {
      return Promise.reject(new Error('user_id required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          user_id: id,
        },
        options
      )
    )
    return this.requestUrl(`/v1/user/detail?${queryString}`)
  }

  userIllusts(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('user_id required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          user_id: id,
        },
        options
      )
    )
    return this.requestUrl(`/v1/user/illusts?${queryString}`)
  }

  userNovels(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('user_id required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          user_id: id,
        },
        options
      )
    )
    return this.requestUrl(`/v1/user/novels?${queryString}`)
  }

  userBookmarksIllust(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('user_id required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          user_id: id,
          restrict: 'public',
        },
        options
      )
    )
    return this.requestUrl(`/v1/user/bookmarks/illust?${queryString}`)
  }

  userBookmarkIllustTags(options: any) {
    const queryString = qs.stringify(
      Object.assign(
        {
          restrict: 'public',
        },
        options
      )
    )
    return this.requestUrl(`/v1/user/bookmark-tags/illust?${queryString}`)
  }

  illustBookmarkDetail(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('illust_id required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          illust_id: id,
        },
        options
      )
    )
    return this.requestUrl(`/v2/illust/bookmark/detail?${queryString}`)
  }

  userBookmarksNovel(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('user_id required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          user_id: id,
          restrict: 'public',
        },
        options
      )
    )
    return this.requestUrl(`/v1/user/bookmarks/novel?${queryString}`)
  }

  userBookmarkNovelTags(options: any) {
    const queryString = qs.stringify(
      Object.assign(
        {
          restrict: 'public',
        },
        options
      )
    )
    return this.requestUrl(`/v1/user/bookmark-tags/novel?${queryString}`)
  }

  illustWalkthrough() {
    return this.requestUrl('/v1/walkthrough/illusts')
  }

  illustComments(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('illust_id required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          illust_id: id,
          include_total_comments: true,
        },
        options
      )
    )
    return this.requestUrl(`/v1/illust/comments?${queryString}`)
  }

  illustCommentsV3(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('illust_id required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          illust_id: id,
        },
        options
      )
    )
    return this.requestUrl(`/v3/illust/comments?${queryString}`)
  }

  illustCommentsV2(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('illust_id required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          illust_id: id,
        },
        options
      )
    )
    return this.requestUrl(`/v2/illust/comments?${queryString}`)
  }

  illustCommentReplies(id: any) {
    if (!id) {
      return Promise.reject(new Error('comment_id required'))
    }
    const queryString = qs.stringify({ comment_id: id })
    return this.requestUrl(`/v2/illust/comment/replies?${queryString}`)
  }

  illustRelated(id: any, options: Record<string, any> = {}) {
    if (!id) {
      return Promise.reject(new Error('illust_id required'))
    }

    const { nextUrl } = options
    delete options.nextUrl
    const queryString =
      nextUrl ||
      qs.stringify(
        Object.assign(
          {
            illust_id: id,
          },
          options
        )
      )
    return this.requestUrl(`/v2/illust/related?${queryString}`)
  }

  novelRelated(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('novel_id required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          novel_id: id,
        },
        options
      )
    )
    return this.requestUrl(`/v1/novel/related?${queryString}`)
  }

  userRelated(id: any, options: Record<string, any> = {}) {
    if (!id) {
      return Promise.reject(new Error('user_id required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          seed_user_id: id,
        },
        options
      )
    )
    return this.requestUrl(`/v1/user/related?${queryString}`)
  }

  illustDetail(id: any, options: Record<string, any> = {}) {
    if (!id) {
      return Promise.reject(new Error('illust_id required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          illust_id: id,
        },
        options
      )
    )
    return this.requestUrl(`/v1/illust/detail?${queryString}`)
  }

  illustNew(options: any) {
    const queryString = qs.stringify(
      Object.assign(
        {
          content_type: 'illust',
        },
        options
      )
    )
    return this.requestUrl(`/v1/illust/new?${queryString}`)
  }

  illustFollow(options: any) {
    const queryString = qs.stringify(
      Object.assign(
        {
          restrict: 'all',
        },
        options
      )
    )
    return this.requestUrl(`/v2/illust/follow?${queryString}`)
  }

  illustRecommended(options: any) {
    const queryString = qs.stringify(
      Object.assign(
        {
          include_ranking_illusts: true,
        },
        options
      )
    )
    return this.requestUrl(`/v1/illust/recommended?${queryString}`)
  }

  illustRanking(options: any) {
    const queryString = qs.stringify(
      Object.assign(
        {
          mode: 'day',
        },
        options
      )
    )
    return this.requestUrl(`/v1/illust/ranking?${queryString}`)
  }

  illustMyPixiv() {
    return this.requestUrl('/v2/illust/mypixiv')
  }

  illustAddComment(id: any, comment: any, parentCommentId: any) {
    if (!id) {
      return Promise.reject(new Error('illust_id required'))
    }
    if (!comment) {
      return Promise.reject(new Error('comment required'))
    }
    const data = qs.stringify({
      illust_id: id,
      comment,
      parent_comment_id: parentCommentId,
    })
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data,
    }
    return this.requestUrl('/v1/illust/comment/add', options)
  }

  novelAddComment(id: any, comment: any, parentCommentId: any) {
    if (!id) {
      return Promise.reject(new Error('novel_id required'))
    }
    if (!comment) {
      return Promise.reject(new Error('comment required'))
    }
    const data = qs.stringify({
      novel_id: id,
      comment,
      parent_comment_id: parentCommentId,
    })
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data,
    }
    return this.requestUrl('/v1/novel/comment/add', options)
  }

  trendingTagsIllust(options: any) {
    const queryString = qs.stringify(Object.assign({}, options))
    return this.requestUrl(`/v1/trending-tags/illust?${queryString}`)
  }

  trendingTagsNovel(options: any) {
    const queryString = qs.stringify(Object.assign({}, options))
    return this.requestUrl(`/v1/trending-tags/novel?${queryString}`)
  }

  bookmarkIllust(id: any, restrict: string, tags: any[]) {
    if (!id) {
      return Promise.reject(new Error('illust_id required'))
    }
    if (restrict && !['public', 'private'].includes(restrict)) {
      return Promise.reject(new Error('invalid restrict value'))
    }
    if (tags && !Array.isArray(tags)) {
      return Promise.reject(new Error('invalid tags value'))
    }
    const data = qs.stringify({
      illust_id: id,
      restrict: restrict || 'public',
      tags: tags && tags.length ? tags : undefined,
    })
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data,
    }
    return this.requestUrl('/v2/illust/bookmark/add', options)
  }

  unbookmarkIllust(id: any) {
    if (!id) {
      return Promise.reject(new Error('illust_id required'))
    }
    const data = qs.stringify({
      illust_id: id,
    })
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data,
    }
    return this.requestUrl('/v1/illust/bookmark/delete', options)
  }

  bookmarkNovel(id: any, restrict: string, tags: any[]) {
    if (!id) {
      return Promise.reject(new Error('novel_id required'))
    }
    if (restrict && !['public', 'private'].includes(restrict)) {
      return Promise.reject(new Error('invalid restrict value'))
    }
    if (tags && !Array.isArray(tags)) {
      return Promise.reject(new Error('invalid tags value'))
    }
    const data = qs.stringify({
      novel_id: id,
      restrict: restrict || 'public',
      tags: tags && tags.length ? tags : undefined,
    })
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data,
    }
    return this.requestUrl('/v2/novel/bookmark/add', options)
  }

  unbookmarkNovel(id: any) {
    if (!id) {
      return Promise.reject(new Error('novel_id required'))
    }
    const data = qs.stringify({
      novel_id: id,
    })
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data,
    }
    return this.requestUrl('/v1/novel/bookmark/delete', options)
  }

  followUser(id: any, restrict: string) {
    if (!id) {
      return Promise.reject(new Error('user_id required'))
    }
    if (restrict && !['public', 'private'].includes(restrict)) {
      return Promise.reject(new Error('invalid restrict value'))
    }
    const data = qs.stringify({
      user_id: id,
      restrict: restrict || 'public',
    })
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data,
    }
    return this.requestUrl('/v1/user/follow/add', options)
  }

  unfollowUser(id: any) {
    if (!id) {
      return Promise.reject(new Error('user_id required'))
    }
    const data = qs.stringify({
      user_id: id,
      restrict: 'public',
    })
    //
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data,
    }
    return this.requestUrl('/v1/user/follow/delete', options)
  }

  mangaRecommended(options: any) {
    const queryString = qs.stringify(
      Object.assign(
        {
          include_ranking_label: true,
          include_privacy_policy: false,
          include_ranking_illusts: false,
        },
        options
      )
    )
    return this.requestUrl(`/v1/manga/recommended?${queryString}`)
  }

  mangaNew(options: any) {
    const queryString = qs.stringify(
      Object.assign(
        {
          content_type: 'manga',
        },
        options
      )
    )
    return this.requestUrl(`/v1/illust/new?${queryString}`)
  }

  novelRecommended(options: any) {
    const queryString = qs.stringify(
      Object.assign(
        {
          include_ranking_novels: false,
          include_privacy_policy: false,
        },
        options
      )
    )
    return this.requestUrl(`/v1/novel/recommended?${queryString}`)
  }

  novelNew(options: any) {
    const queryString = qs.stringify(options)
    return this.requestUrl(`/v1/novel/new?${queryString}`)
  }

  novelComments(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('novel_id required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          novel_id: id,
          include_total_comments: true,
        },
        options
      )
    )
    return this.requestUrl(`/v1/novel/comments?${queryString}`)
  }

  novelCommentsV2(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('novel_id required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          novel_id: id,
        },
        options
      )
    )
    return this.requestUrl(`/v2/novel/comments?${queryString}`)
  }

  novelCommentsV3(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('novel_id required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          novel_id: id,
        },
        options
      )
    )
    return this.requestUrl(`/v3/novel/comments?${queryString}`)
  }

  novelCommentReplies(id: any) {
    if (!id) {
      return Promise.reject(new Error('comment_id required'))
    }
    const queryString = qs.stringify({ comment_id: id })
    return this.requestUrl(`/v2/novel/comment/replies?${queryString}`)
  }

  userIllustSeries(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('user_id required'))
    }

    const queryString = qs.stringify({ user_id: id, ...options })
    return this.requestUrl(`/v1/user/illust-series?${queryString}`)
  }

  userNovelSeries(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('user_id required'))
    }

    const queryString = qs.stringify({ user_id: id, ...options })
    return this.requestUrl(`/v1/user/novel-series?${queryString}`)
  }

  illustSeries(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('illust_series_id required'))
    }

    const queryString = qs.stringify({ illust_series_id: id, ...options })
    return this.requestUrl(`/v1/illust/series?${queryString}`)
  }

  novelSeries(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('series_id required'))
    }

    const queryString = qs.stringify({ series_id: id, ...options })
    return this.requestUrl(`/v2/novel/series?${queryString}`)
  }

  novelDetail(id: any) {
    if (!id) {
      return Promise.reject(new Error('novel_id required'))
    }

    const queryString = qs.stringify({ novel_id: id })
    return this.requestUrl(`/v2/novel/detail?${queryString}`)
  }

  async novelText(id: any) {
    if (!id) {
      return Promise.reject(new Error('novel_id required'))
    }

    // const queryString = qs.stringify({ novel_id: id })
    // return this.requestUrl(`/v1/novel/text?${queryString}`)

    const r = await this.webviewNovel(id)
    return { novel_text: r.text }
  }

  async webviewNovel(id: any, raw = false) {
    if (!id) {
      throw new Error('novel_id required')
    }

    const queryString = qs.stringify({ id, viewer_version: '20221031_ai' })
    const response = await this.requestUrl(`/webview/v2/novel?${queryString}`, {
      responseType: 'text',
    })

    if (raw) return response

    const json = response.match(/novel:\s({.+}),/)?.[1]
    return JSON.parse(json)
  }

  novelFollow(options: any) {
    const queryString = qs.stringify(
      Object.assign(
        {
          restrict: 'all',
        },
        options
      )
    )
    return this.requestUrl(`/v1/novel/follow?${queryString}`)
  }

  novelMyPixiv() {
    return this.requestUrl('/v1/novel/mypixiv')
  }

  novelRanking(options: any) {
    const queryString = qs.stringify(
      Object.assign(
        {
          mode: 'day',
        },
        options
      )
    )
    return this.requestUrl(`/v1/novel/ranking?${queryString}`)
  }

  novelBookmarkDetail(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('novel_id required'))
    }

    const queryString = qs.stringify(
      Object.assign(
        {
          novel_id: id,
        },
        options
      )
    )
    return this.requestUrl(`/v2/novel/bookmark/detail?${queryString}`)
  }

  userRecommended(options: any) {
    const queryString = qs.stringify(Object.assign({}, options))
    return this.requestUrl(`/v1/user/recommended?${queryString}`)
  }

  userFollowing(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('user_id required'))
    }
    const queryString = qs.stringify(
      Object.assign(
        {
          user_id: id,
          restrict: 'public',
        },
        options
      )
    )
    return this.requestUrl(`/v1/user/following?${queryString}`)
  }

  userFollowDetail(id: any) {
    if (!id) {
      return Promise.reject(new Error('user_id required'))
    }
    const queryString = qs.stringify({ user_id: id })
    return this.requestUrl(`/v1/user/follow/detail?${queryString}`)
  }

  userFollower(id: any, options: any) {
    if (!id) {
      return Promise.reject(new Error('user_id required'))
    }
    const queryString = qs.stringify(
      Object.assign(
        {
          user_id: id,
        },
        options
      )
    )
    return this.requestUrl(`/v1/user/follower?${queryString}`)
  }

  userMyPixiv(id: any) {
    if (!id) {
      return Promise.reject(new Error('user_id required'))
    }
    const queryString = qs.stringify({ user_id: id })
    return this.requestUrl(`/v1/user/mypixiv?${queryString}`)
  }

  ugoiraMetaData(id: any) {
    if (!id) {
      return Promise.reject(new Error('illust_id required'))
    }
    const queryString = qs.stringify({ illust_id: id })
    return this.requestUrl(`/v1/ugoira/metadata?${queryString}`)
  }

  liveList(options: any) {
    const queryString = qs.stringify(
      Object.assign(
        {
          list_type: 'popular',
        },
        options
      )
    )
    return this.requestUrl(`/v1/live/list?${queryString}`)
  }

  spotlights(options: any) {
    const queryString = qs.stringify(
      Object.assign(
        {
          filter: 'for_android',
          category: 'all',
        },
        options
      )
    )
    return this.requestUrl(`/v1/spotlight/articles?${queryString}`)
  }
}

export default PixivApi
