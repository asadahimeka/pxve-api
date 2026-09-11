import { Hono } from 'hono'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
import { pixivApiProxy } from '@services/pixiv/api-proxy.ts'

export const pixivApiProxyRoute = new Hono().on(
  ['GET', 'POST'],
  ['/pixiv-oauth/*', '/pixiv-app-api/*'],
  openApi({
    description:
      'Pixiv APP API 代理转发，<br>例如 `GET /pixiv-app-api/v1/walkthrough/illusts` <br> `Authorization` 头（Pixiv access token）及 `X-Client-Time` / `X-Client-Hash` 会原样转发给上游；<br>设置 `API_TOKEN` 后需另在 header 携带 `x-api-token: <API_TOKEN>` 用于网关鉴权',
    tags: ['Pixiv', 'Proxy'],
    request: { param: z.object() },
    responses: { 200: z.object() },
  }),
  async c => {
    const resp = await pixivApiProxy(c.req.url, c.req.raw)
    return c.body(resp.body!, resp)
  }
)
