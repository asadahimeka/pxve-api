import { Hono } from 'hono'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
import { recoverPidImage } from '@services/pixiv/pid-recover.ts'

export const pidRecoverRoute = new Hono().get(
  '/pid-recover/:id',
  openApi({
    description: '根据 Pixiv 插画 ID 到 Danbooru/Gelbooru/Yandere 站查找记录',
    tags: ['Pixiv'],
    request: {
      param: z.object({
        id: z
          .string()
          .regex(/^\d{8,}$/)
          .meta({
            description: 'Pixiv 插画 ID',
            example: '134903417',
          }),
      }),
    },
    responses: {
      200: z.object({
        source: z.string(),
        tags: z.array(z.string()),
        createDate: z.string(),
        fileUrl: z.url(),
        sampleUrl: z.url(),
      }),
    },
  }),
  async c => {
    const { id } = c.req.valid('param')
    const body = await recoverPidImage(id)
    if (!body) return c.notFound()
    return c.text(body, 200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'max-age=86400',
    })
  }
)
