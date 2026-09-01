import { Hono } from 'hono'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
import { fetchPximg, fetchPximgByPidPath } from '@services/pximg.ts'

export const pximgRoute = new Hono()

pximgRoute.get(
  '/pximg/*',
  openApi({
    description:
      'pximg 图片代理，`*` 为去除 `https://i.pximg.net/` 的部分 <br> 示例：`/pximg/c/540x540_70/img-master/img/2025/12/18/00/00/34/138723545_p0_master1200.jpg`',
    tags: ['Pixiv', 'Image'],
    request: { param: z.object() },
    responses: {
      200: {
        mediaType: 'application/octet-stream',
        schema: z.string().meta({ format: 'binary' }),
      },
    },
  }),
  async c => {
    const path = c.req.path.replace('/pximg', '')
    if (!path || path === '/') return c.notFound()
    const res = await fetchPximg(path)
    return res
  }
)

pximgRoute.get(
  '/pid/:path',
  openApi({
    description: `通过 Pixiv ID 获取对应作品的图片<br>
示例：\`/pid/138723545_0_m\`<br>
参数格式：\`<插画ID>_<页码>_<画质>\`
- 插画ID：例如\`https://www.pixiv.net/artworks/138723545\` 里的\`138723545\`
- 页码：作品的第几张图片，从 \`0\` 开始计数，可不传，默认为 \`0\`
- 画质：图片清晰度，可不传，默认为 \`o\`
  - \`s\`: 低清方图
  - \`m\`: 中等
  - \`l\`: 大图
  - \`o\`: 原图
`,
    tags: ['Pixiv', 'Image'],
    request: {
      param: z.object({
        path: z
          .string()
          .regex(/^(\d+)(_(\d+)_?(s|m|l|o)?)?$/)
          .meta({ example: '138723545_0_m' }),
      }),
    },
    responses: {
      200: {
        mediaType: 'application/octet-stream',
        schema: z.string().meta({ format: 'binary' }),
      },
      301: z.object(),
    },
  }),
  async c => {
    const res = await fetchPximgByPidPath(c.req.path)
    return res
  }
)
