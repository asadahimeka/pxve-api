import { Hono } from 'hono'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
import { convertWebP } from '@services/webp.ts'

export const webpConvertRoute = new Hono().get(
  '/webp/*',
  openApi({
    description:
      'WebP 图片转换，示例：`/api/webp/https://cf-static.shinycolors.moe/images/content/support_idols/card/2030150110.jpg?w=359&h=202`',
    tags: ['Image'],
    request: {
      param: z.object(),
      query: z.object({
        w: z.string().regex(/^\d+$/).optional().meta({ description: '可设定返回图片的宽度' }),
        h: z.string().regex(/^\d+$/).optional().meta({ description: '可设定返回图片的高度' }),
      }),
    },
    responses: {
      200: {
        mediaType: 'application/octet-stream',
        schema: z.string().meta({ format: 'binary' }),
      },
    },
  }),
  async c => {
    const { data, headers } = await convertWebP(c.req.url)
    return c.body(data, 200, headers)
  }
)
