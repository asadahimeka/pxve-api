import { Hono } from 'hono'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
import { callPixivAction, pixivActionKeys, withPixivRefresh } from '@services/pixiv/action.ts'

export const pixivApiRoute = new Hono()

pixivApiRoute.get(
  '/pixiv/',
  openApi({
    description:
      'HibiAPI Pixiv JournalAD style 兼容部分，建议使用下面的 `/api/pixiv/{key}` 格式，可参照 HibiAPI 文档：[/docs/hibiapi#tag/pixiv/GET/api/pixiv/](/docs/hibiapi#tag/pixiv/GET/api/pixiv/)',
    tags: ['HibiAPI Compat'],
    request: {
      query: z.object({
        type: z.enum(pixivActionKeys).meta({
          description: 'HibiAPI Pixiv JournalAD style API routing',
          example: 'tags',
        }),
      }),
    },
    responses: {
      301: z.object(),
    },
  }),
  c => {
    const { type } = c.req.valid('query')
    const query = c.req.query()
    delete query.type
    const search = new URLSearchParams(query)
    let redirectUrl = `/api/pixiv/${type}`
    if (search.size > 0) redirectUrl += `?${search}`
    return c.redirect(redirectUrl, 301)
  }
)

pixivApiRoute.get(
  '/pixiv/:key',
  openApi({
    description: 'HibiAPI Pixiv 兼容部分，可参照 HibiAPI 文档：[/docs/hibiapi#tag/pixiv](/docs/hibiapi#tag/pixiv)',
    tags: ['Pixiv', 'HibiAPI Compat'],
    request: {
      param: z.object({
        key: z.enum(pixivActionKeys).meta({
          description: 'HibiAPI Pixiv 路由',
          example: 'tags',
        }),
      }),
    },
    responses: {
      200: z.object(),
    },
  }),
  async c => {
    const { key } = c.req.valid('param')
    const query = c.req.query()

    try {
      const res = await withPixivRefresh(() => callPixivAction(key, query))
      if (!res) return c.notFound()

      const { data, maxAge } = res
      if (maxAge != null) {
        c.header('Cache-Control', `max-age=${maxAge}`)
      }

      return c.json(data, 200)
    } catch (err: any) {
      const msg = err.cause || { error: err.message || err }
      console.error('[ERROR]:', new Date().toLocaleString('zh'), c.req.method, c.req.url, msg)
      return c.json(msg, 500)
    }
  }
)
