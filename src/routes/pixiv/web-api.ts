import { Hono } from 'hono'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
import { pixivWebApi } from '@services/pixiv/web-api.ts'

const allowedFuncs = [
  'discovery',
  'illust',
  'illustDiscovery',
  'illustNew',
  'illustPages',
  'illustRecommendIllusts',
  'illustRecommendInit',
  'illustUgoiraMeta',
  'novel',
  'novelRecommendIllusts',
  'novelRecommendInit',
  'novelSeries',
  'novelSeriesContent',
  'novelSeriesContentTitles',
  'ranking',
  'search',
  'searchSuggestion',
  'series',
  'tagInfo',
  'tagsSuggestByWord',
  'top',
  'user',
  'userFollowing',
  'userIllustsBookmarks',
  'userIllustsBookMarkTags',
  'userNovelsBookmarks',
  'userNovelsBookMarkTags',
  'userProfile',
  'userRecommends',
  'userTag',
  'userTags',
  'userWorksLatest',
] as const

export const pixivWebApiRoute = new Hono().get(
  '/pixiv-web-api/:func',
  openApi({
    description: '使用 [`@__dirname/pixiv-web-api`](https://github.com/YieldRay/pixiv-web-api) 包调用 Pixiv Web API',
    tags: ['Pixiv'],
    request: {
      param: z.object({
        func: z.enum(allowedFuncs).meta({
          description: '填写 `@__dirname/pixiv-web-api` 导出的方法名字，比如：`search`',
          example: 'search',
        }),
      }),
      query: z.object({
        args: z.string().optional().meta({
          description:
            '填写方法调用需要的参数，使用 JSON 数组形式，按照方法参数传入的顺序填写，比如：`["artworks", "初音ミク", {"mode":"all","order":"date_d","p":"1"}]`',
          example: '["artworks", "初音ミク", {"mode":"all","order":"date_d","p":"1"}]',
        }),
      }),
    },
    responses: {
      200: z.object(),
    },
  }),
  async c => {
    const { func } = c.req.valid('param')

    if (!allowedFuncs.includes(func)) return c.notFound()

    const fn = pixivWebApi[func]
    if (!fn) return c.notFound()

    const { args } = c.req.valid('query')
    const funcArgs = args ? JSON.parse(decodeURIComponent(args)) : []

    // @ts-expect-error funcArgs cant typing
    const data = await fn(...funcArgs)

    return c.json(data, 200, { 'Cache-Control': 'max-age=600' })
  }
)
