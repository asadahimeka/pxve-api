import { Hono } from 'hono'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
import { illuminartyImageAnalysis } from '@services/illuminarty.ts'

export const aiImageDetectRoute = new Hono().get(
  '/ai-image-detect',
  openApi({
    description: '检测图片是否为 AI 生成，结果仅供参考（准确率不高）。',
    tags: ['Image'],
    request: {
      query: z.object({
        url: z.url().meta({
          description: '图片链接地址',
          example: 'https://i.pixiv.re/img-master/img/2026/01/21/13/00/03/140198766_p0_master1200.jpg',
        }),
      }),
    },
    responses: {
      200: z.object({
        status: z.enum(['success', 'error']),
        message: z.string().optional(),
        data: z.object({ probability: z.number().min(0).max(1).meta({ example: '0.05' }) }),
      }),
    },
  }),
  async c => {
    const { url } = c.req.valid('query')

    try {
      const resp = await illuminartyImageAnalysis(url)
      if (resp.ok) c.header('Cache-Control', 'max-age=86400')
      return c.body(resp.body!, resp)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.startsWith('blocked ')) {
        return c.json({ error: msg }, 400)
      }
      return c.json({ error: 'Image analysis error' }, 502)
    }
  }
)
