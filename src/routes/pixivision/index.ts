import { Hono } from 'hono'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
import { fetchPixivisionDetail, fetchPixivisionDetailContent, fetchPixivisionList } from '@services/pixivision.ts'

export const pixivisionRoute = new Hono()

const PixivisionListTypes = [
  'illustration',
  'manga',
  'novels',
  'column',
  'recommend',
  'interview',
  'news',
  'cosplay',
  'music',
  'goods',
  'how-to-draw',
  'draw-step-by-step',
  'textures',
  'art-references',
  'how-to-make',
  'deskwatch',
  'try-out',
] as const

const PixivisionListItem = z.object({
  id: z.string(),
  title: z.string(),
  pure_title: z.string(),
  thumbnail: z.url(),
  article_url: z.url(),
  publish_date: z.string(),
  tags: z.array(z.string()),
})

const PixivisionListResponse = z.object({
  articles: z.array(PixivisionListItem),
  rank: z.array(PixivisionListItem),
  recommend: z.array(PixivisionListItem),
})

pixivisionRoute.get(
  '/pixivision',
  openApi({
    description: '获取 pixivision 插画特辑列表',
    tags: ['Pixivision', 'Pixiv'],
    request: {
      query: z.object({
        page: z.string().regex(/^\d+$/).optional().meta({ description: '页码', example: '1' }),
        lang: z.string().optional().meta({ description: '语种', example: 'en' }),
      }),
    },
    responses: {
      200: PixivisionListResponse,
    },
  }),
  async c => {
    const query = c.req.valid('query')
    const data = await fetchPixivisionList(query)
    return c.json(data, 200, { 'Cache-Control': 'max-age=21600' })
  }
)

pixivisionRoute.get(
  '/pixivision/list',
  openApi({
    description: '获取 pixivision 特辑列表（根据类型）',
    tags: ['Pixivision', 'Pixiv'],
    request: {
      query: z.object({
        page: z.string().regex(/^\d+$/).optional().meta({ description: '页码', example: '1' }),
        lang: z.string().optional().meta({ description: '语种', example: 'en' }),
        type: z.enum(PixivisionListTypes).meta({ description: '特辑类型' }),
      }),
    },
    responses: {
      200: PixivisionListResponse,
    },
  }),
  async c => {
    const query = c.req.valid('query')
    const data = await fetchPixivisionList(query)
    return c.json(data, 200, { 'Cache-Control': 'max-age=21600' })
  }
)

pixivisionRoute.get(
  '/pixivision/detail',
  openApi({
    description: '获取 pixivision 特辑详情(HTML)',
    tags: ['Pixivision', 'Pixiv'],
    request: {
      query: z.object({
        id: z.string().regex(/^\d+$/).meta({ example: '11220' }),
        lang: z.string().optional().meta({ description: '语种', example: 'en' }),
      }),
    },
    responses: {
      200: z.object({
        title: z.string(),
        date: z.string(),
        content: z.string().meta({ description: 'HTML' }),
        tags: z.array(z.object({ id: z.string(), name: z.string() })),
        related_latest: z.object(),
        related_recommend: z.object(),
      }),
    },
  }),
  async c => {
    const query = c.req.valid('query')
    const data = await fetchPixivisionDetailContent(query)
    return c.json(data, 200, { 'Cache-Control': 'max-age=21600' })
  }
)

pixivisionRoute.get(
  '/pixivision/:id',
  openApi({
    description: '获取 pixivision 特辑详情',
    tags: ['Pixivision', 'Pixiv'],
    request: {
      param: z.object({
        id: z.string().regex(/^\d+$/).meta({ example: '11220' }),
      }),
      query: z.object({
        lang: z.string().optional().meta({ description: '语种', example: 'en' }),
      }),
    },
    responses: {
      200: z.object({
        title: z.string(),
        cover: z.url(),
        date: z.string(),
        desc: z.string(),
        items: z.array(
          z.object({
            title: z.string(),
            illust_id: z.string(),
            illust_url: z.url(),
            user_id: z.string(),
            user_name: z.string(),
            user_avatar: z.url(),
          })
        ),
        tags: z.array(z.object({ id: z.string(), name: z.string() })),
        related_latest: z.object(),
        related_recommend: z.object(),
      }),
    },
  }),
  async c => {
    const { id } = c.req.valid('param')
    const query = c.req.valid('query')
    const data = await fetchPixivisionDetail(id, query)
    return c.json(data, 200, { 'Cache-Control': 'max-age=21600' })
  }
)
