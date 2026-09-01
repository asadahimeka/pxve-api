import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
import { getSessionUserMeta, request } from '@services/pixiv/pixiv-now.ts'

export const pixivNowRoute = new Hono()

pixivNowRoute.on(
  ['GET', 'POST'],
  '/pixiv-now/http/*',
  openApi({
    description:
      'Pixiv Web API 代理转发，例如：`/api/pixiv-now/http/ajax/stories/tag_stories?tag=女の子&lang=zh` <br> 需要传 cookie 的话置于 header 里的 `x-auth`',
    tags: ['Pixiv', 'PixivNow', 'Proxy'],
    request: {
      param: z.object(),
      query: z.object(),
      header: z.object({
        'x-auth': z.string().optional().meta({
          description: '如果需要传入 pixiv cookie 置于此处',
          example: 'PHPSESSID=11111_xxxxxxx',
        }),
        'x-csrf-token': z.string().optional().meta({
          description: 'POST 请求需要传入 CSRF Token',
        }),
      }),
    },
    responses: {
      200: z.object(),
    },
  }),
  async c => {
    const slug = c.req.path.replace('/api/pixiv-now/http', '')
    if (!slug || !/(^\/ajax|rpc)|(.+\.php$)/i.test(slug)) return

    const { data } = await request({
      method: c.req.method,
      path: slug,
      params: c.req.query(),
      data: c.req.raw.body,
      headers: c.req.header(),
    })

    const token = getCookie(c, 'PHPSESSID') || c.req.header('x-auth')
    return c.json(data, 200, { 'Cache-Control': token ? 'no-store' : 'max-age=3600' })
  }
)

pixivNowRoute.get(
  '/pixiv-now/ranking',
  openApi({
    description: '使用 Web API 获取 pixiv 插画榜单数据',
    tags: ['Pixiv', 'PixivNow'],
    request: {
      query: z.object({
        mode: z
          .enum(['daily', 'weekly', 'monthly', 'rookie', 'daily_r18', 'weekly_r18'])
          .optional()
          .meta({ description: '榜单类型' }),
        date: z
          .string()
          .regex(/^\d{8}$/)
          .optional()
          .meta({ description: '榜单日期，格式YYYYMMDD' }),
        content: z.enum(['all', 'illust', 'manga', 'ugoira']).optional().meta({ description: '插画类型' }),
        p: z.string().regex(/^\d+$/).optional().meta({ description: '页码' }),
        format: z.literal('json').optional().default('json'),
      }),
    },
    responses: {
      200: z.object({
        contents: z.array(
          z.object({
            illust_id: z.int().positive(),
            title: z.string(),
            date: z.string(),
            tags: z.array(z.string()),
            url: z.string(),
            width: z.int().positive(),
            height: z.int().positive(),
            user_id: z.int().positive(),
            user_name: z.string(),
            illust_page_count: z.int().positive(),
            x_restrict: z.enum(['0', '1', '2']),
          })
        ),
      }),
    },
  }),
  async c => {
    const query = c.req.valid('query')

    const { data } = await request({
      path: '/ranking.php',
      params: query,
      headers: c.req.header(),
      specHeaders: { referer: 'https://www.pixiv.net/ranking.php' },
    })

    data.contents = data?.contents?.map((i: any) => {
      i.x_restrict = i?.illust_content_type?.sexual || 0
      return i
    })

    return c.json(data, 200, { 'Cache-Control': 'max-age=86400' })
  }
)

pixivNowRoute.get(
  '/pixiv-now/user',
  openApi({
    description: '根据传入的 cookie 获取对应的 pixiv 用户信息',
    tags: ['Pixiv', 'PixivNow'],
    request: {
      header: z.object({
        'x-auth': z.string().optional(),
      }),
      cookie: z.object({
        PHPSESSID: z.string().optional(),
      }),
    },
    responses: {
      200: z.object(),
      401: z.object(),
    },
  }),
  async c => {
    const token = getCookie(c, 'PHPSESSID') || c.req.header('x-auth')
    if (!token) return c.json({ error: '未配置用户密钥' }, 401)

    const { data } = await request({
      params: c.req.query(),
      headers: c.req.header(),
      returnText: true,
    })
    const meta = getSessionUserMeta(data)

    return c.json(meta, 200, {
      'Set-Cookie': `CSRFTOKEN=${meta.token}; path=/; secure`,
      'Cache-Control': 'no-store',
    })
  }
)
