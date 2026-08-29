import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
import { saucenaoSearch } from '@services/saucenao.ts'

const SauceNAOResponseSchema = z.object({
  header: z.object(),
  results: z.array(
    z.object({
      header: z.object({
        similarity: z.string(),
        thumbnail: z.string(),
      }),
      data: z.object({
        source: z.string(),
        ext_urls: z.array(z.string()),
        danbooru_id: z.string(),
        gelbooru_id: z.string(),
        pixiv_id: z.string(),
      }),
    })
  ),
})

export const saucenaoRoute = new Hono()
  .get(
    '/sauce/',
    openApi({
      description: '使用 SauceNAO 检索网络图片',
      tags: ['Image', 'HibiAPI Compat'],
      request: {
        query: z.object({
          url: z.url().meta({
            description: '图片链接地址',
            example: 'https://i.pixiv.re/img-master/img/2025/12/31/00/00/40/139282999_p0_master1200.jpg',
          }),
        }),
      },
      responses: { 200: SauceNAOResponseSchema },
    }),
    async c => {
      const { url } = c.req.valid('query')
      const resp = await saucenaoSearch(url)
      return resp
    }
  )
  .post(
    '/sauce/',
    openApi({
      description: '使用 SauceNAO 检索表单上传图片',
      tags: ['Image', 'HibiAPI Compat'],
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              file: z.string().meta({
                format: 'binary',
                description: '上传的图片',
              }),
            }),
          },
        },
      },
      responses: {
        200: SauceNAOResponseSchema,
        400: z.object({ error: z.string() }),
        413: z.object({ error: z.string() }),
      },
    }),
    bodyLimit({
      maxSize: 5 * 1024 * 1024, // 5MB
      onError: c => c.json({ error: 'File too large' }, 413),
    }),
    async c => {
      const reqBody = await c.req.parseBody()
      const file = reqBody.file

      if (!(file instanceof File)) {
        return c.json({ error: 'No file uploaded' }, 400)
      }

      if (!file.type.includes('image/')) {
        return c.json({ error: 'You need an Image' }, 400)
      }

      const resp = await saucenaoSearch(file)
      return resp
    }
  )
