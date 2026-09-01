import { Hono } from 'hono'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
import { HIBIAPI_BASE, UA_HEADER } from '@lib/const.ts'

export const hibiapiFallbackRoute = new Hono().on(
  'GET',
  [
    '/api/bilibili/v2/:action',
    '/api/bilibili/v2/',
    '/api/bilibili/v3/:action',
    '/api/bilibili/v3/',
    '/api/netease/:action',
    '/api/netease/',
    '/api/qrcode/',
    '/api/tieba/:action',
    '/api/tieba/',
    '/api/wallpaper/:action',
    '/api/wallpaper/',
    '/api/bika/:action',
    '/api/bika/',
  ],
  openApi({
    description: 'HibiAPI 除 Pixiv 的其他部分代理转发，文档参照：[/docs/hibiapi](/docs/hibiapi)',
    tags: ['HibiAPI Compat'],
    request: { param: z.object() },
    responses: { 200: z.object() },
  }),
  c => {
    if (!HIBIAPI_BASE) return c.notFound()
    const url = new URL(c.req.url)
    url.protocol = 'https:'
    url.port = ''
    url.host = HIBIAPI_BASE
    return fetch(url, { headers: UA_HEADER })
  }
)
