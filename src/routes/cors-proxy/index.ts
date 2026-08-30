import { Hono } from 'hono'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
import { commonProxy } from '@services/proxy.ts'

export const proxyRoute = new Hono().on(
  ['GET', 'POST'],
  '/proxy/*',
  openApi({
    description: '通用 CORS 代理，示例：`/proxy/https://yande.re/post.json?limit=1`',
    tags: ['Proxy'],
    request: { param: z.object() },
    responses: { 200: z.object() },
  }),
  async c => {
    try {
      const resp = await commonProxy(c.req.raw)
      return resp
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.startsWith('blocked ')) {
        return c.json({ error: msg }, 400)
      }
      return c.json({ error: 'Proxy error' }, 502)
    }
  }
)
