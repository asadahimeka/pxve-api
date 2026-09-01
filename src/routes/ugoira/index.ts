import { Hono } from 'hono'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
import { convertUgoira, ugoiraExtRegex, ugoiraExts } from '@services/ugoira.ts'

export const ugoiraRoute = new Hono().get(
  '/ugoira/:id',
  openApi({
    description: 'Pixiv 动图转换',
    tags: ['Pixiv'],
    request: {
      param: z.object({
        id: z
          .string()
          .regex(ugoiraExtRegex, {
            message: `ID must be in format "number.<${ugoiraExts.join('|')}>", e.g. "139993591.mp4"`,
          })
          .meta({
            description: 'Pixiv Ugoira ID with extension',
            example: '139993591.mp4',
          }),
      }),
      query: z.object({
        zip: z.url().optional().meta({
          description: '动图压缩包链接，可以不提供；不提供将从 API 获取；如果提供的话需要一并提供 `rate`。',
          example: 'https://i.pixiv.re/img-zip-ugoira/img/2026/01/16/12/29/50/139993591_ugoira1920x1080.zip',
        }),
        rate: z.string().regex(/^\d+$/).optional().meta({
          description: '动图转换帧率，可以不提供；不提供将自动计算；如果提供的话需要一并提供 `zip`。',
          example: '16',
        }),
      }),
    },
    responses: {
      200: {
        mediaType: 'application/octet-stream',
        schema: z.string().meta({
          format: 'binary',
          description: 'Raw image/video data',
        }),
      },
    },
  }),
  async c => {
    const { id } = c.req.valid('param')
    const { zip, rate } = c.req.valid('query')

    const { data, headers } = await convertUgoira(id, zip, rate)

    return c.body(data, 200, headers)
  }
)
