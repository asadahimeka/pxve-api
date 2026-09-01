import { Hono } from 'hono'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
import { pixivApiProxy } from '@services/pixiv/api-proxy.ts'

export const pixivApiProxyRoute = new Hono().on(
  ['GET', 'POST'],
  ['/pixiv-oauth/*', '/pixiv-app-api/*'],
  openApi({
    description: 'Pixiv APP API 代理转发，<br>例如 `GET /pixiv-app-api/v1/walkthrough/illusts`',
    tags: ['Pixiv', 'Proxy'],
    request: { param: z.object() },
    responses: { 200: z.object() },
  }),
  async c => {
    const resp = await pixivApiProxy(c.req.url, c.req.raw)
    return c.body(resp.body!, resp)
  }
)
