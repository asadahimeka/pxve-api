import { Hono } from 'hono'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
import { translatePixivNovel } from '@services/pixiv/translate.ts'

export const pixivTranslateNovelRoute = new Hono().get(
  '/pixiv-novel-translate/:id',
  openApi({
    description: '将 pixiv 小说翻译为中文，返回 HTML 格式',
    tags: ['Pixiv'],
    request: {
      param: z.object({
        id: z
          .string()
          .regex(/^\d+\.html$/)
          .meta({
            description: 'Pixiv Novel ID ends with `.html`',
            example: '27077032.html',
          }),
      }),
      query: z.object({
        srv: z.enum(['ms', 'gg', 'yd', 'sc']).meta({
          description: '翻译服务: ms: 微软翻译 | gg: 谷歌翻译 | yd: 有道翻译 | sc: AI 翻译',
        }),
        to: z.string().optional(),
        nots: z.string().optional(),
        aimd: z.string().optional(),
      }),
    },
    responses: {
      200: {
        mediaType: 'text/html',
        schema: z.string().meta({
          description: '翻译完成的小说 HTML',
        }),
      },
    },
  }),
  async c => {
    const { id } = c.req.valid('param')
    const query = c.req.valid('query')
    const { body, headers } = await translatePixivNovel(id, query)
    return c.body(body, 200, headers)
  }
)
