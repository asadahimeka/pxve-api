import { Hono } from 'hono'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
import { runFetchXMediaCmd } from '@services/x-media/index.ts'

export const xMediaRoute = new Hono().get(
  '/x/media',
  openApi({
    description: `获取 X(Twitter) 用户的媒体推文<br>
需要 python 环境以及 \`pip install twikit\`<br>
示例：\`/api/x/media?userName=k_rity\`<br>
第一次请求可只传入 \`userName\`, 从返回结果里获取 \`user_id\` 和 \`next_cursor\` 以供后续请求
`,
    tags: ['X(Twitter)'],
    request: {
      query: z.object({
        userName: z.string().optional().meta({
          description: 'X(Twitter) 用户的 screen_name, 即 `@` 后的部分',
          example: 'k_rity',
        }),
        userId: z.string().regex(/^\d+$/).optional().meta({
          description: 'X(Twitter) 用户的 user_id, 可代替 `userName`，减少查询次数',
          example: '804284210529742848',
        }),
        nextCursor: z.string().optional().meta({
          description: '分页游标',
        }),
      }),
    },
    responses: {
      200: z.object(),
    },
  }),
  async c => {
    const { userName, userId, nextCursor } = c.req.valid('query')

    // Validate userName: alphanumeric + underscore, 1-15 chars
    if (userName && !/^[A-Za-z0-9_]{1,15}$/.test(userName)) {
      return c.json({ error: 'invalid userName' }, 400)
    }
    // Validate nextCursor: alphanumeric + underscore/hyphen/base64 chars, 1-64 chars
    if (nextCursor && !/^[A-Za-z0-9_\-=+/]{1,64}$/.test(nextCursor)) {
      return c.json({ error: 'invalid cursor' }, 400)
    }

    const res = await runFetchXMediaCmd(userName, userId, nextCursor)
    return c.json(res, 200, { 'Cache-Control': 'public, max-age=86400' })
  }
)
