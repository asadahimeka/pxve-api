import { Hono } from 'hono'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
import { UA_HEADER } from '@lib/const.ts'

const CATEGORY_MAP: Record<string, string> = {
  girl: '4e4d610cdf714d2966000000',
  animal: '4e4d610cdf714d2966000001',
  landscape: '4e4d610cdf714d2966000002',
  anime: '4e4d610cdf714d2966000003',
  drawn: '4e4d610cdf714d2966000004',
  mechanics: '4e4d610cdf714d2966000005',
  boy: '4e4d610cdf714d2966000006',
  game: '4e4d610cdf714d2966000007',
  text: '5109e04e48d5b9364ae9ac45',
}

const WALLPAPER_BASE = 'http://service.aibizhi.adesk.com'

const WallpaperQuerySchema = z.object({
  type: z.enum(['wallpaper', 'vertical']).meta({ description: '壁纸横屏/竖屏' }),
  category: z
    .enum(['girl', 'animal', 'landscape', 'anime', 'drawn', 'mechanics', 'boy', 'game', 'text'])
    .meta({ description: '壁纸分类：女生/动物/自然/二次元/手绘/机械/男生/游戏/文字' }),
  limit: z.coerce.number().int().min(1).max(100).default(20).meta({ description: '数量', example: 20 }),
  skip: z.coerce.number().int().min(0).default(0).meta({ description: '跳过数量', example: 0 }),
  adult: z.coerce.boolean().default(true).meta({ description: '是否包含成人内容' }),
  order: z.enum(['hot', 'new']).meta({ description: '排序方式：热门/最新' }).default('hot'),
})

async function fetchWallpaper(query: z.infer<typeof WallpaperQuerySchema>): Promise<unknown> {
  const type = query.type
  const hash = CATEGORY_MAP[query.category]
  const url = new URL(`/v1/${type}/category/${hash}/${type}`, WALLPAPER_BASE)
  url.searchParams.set('limit', String(query.limit))
  url.searchParams.set('skip', String(query.skip))
  url.searchParams.set('adult', String(query.adult))
  url.searchParams.set('order', query.order)
  url.searchParams.set('first', '0')
  url.searchParams.set('category', hash)

  console.log('url: ', url + '')
  const resp = await fetch(url, { headers: UA_HEADER })

  if (!resp.ok) {
    throw new Error(`Upstream returned ${resp.status}: ${resp.statusText}`)
  }

  return await resp.json()
}

export const wallpaperRoute = new Hono()

wallpaperRoute.get(
  '/wallpaper',
  openApi({
    description: '获取壁纸列表',
    tags: ['Image', 'HibiAPI Compat'],
    request: {
      query: WallpaperQuerySchema,
    },
    responses: {
      200: z.any(),
      400: z.object({ error: z.string() }),
      502: z.object({ error: z.string() }),
    },
  }),
  async c => {
    const query = c.req.valid('query')
    try {
      const data = await fetchWallpaper(query)
      return c.json(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return c.json({ error: msg }, 502)
    }
  }
)

wallpaperRoute.get(
  '/wallpaper/wallpaper',
  openApi({
    description: '获取壁纸列表，重定向到 `/api/wallpaper?type=wallpaper`',
    tags: ['Image', 'HibiAPI Compat'],
    responses: { 301: z.object() },
  }),
  c => c.redirect(`/api/wallpaper?type=wallpaper&${new URLSearchParams(c.req.query())}`, 301)
)

wallpaperRoute.get(
  '/wallpaper/vertical',
  openApi({
    description: '获取竖屏壁纸列表，重定向到 `/api/wallpaper?type=vertical`',
    tags: ['Image', 'HibiAPI Compat'],
    responses: { 301: z.object() },
  }),
  c => c.redirect(`/api/wallpaper?type=vertical&${new URLSearchParams(c.req.query())}`, 301)
)
