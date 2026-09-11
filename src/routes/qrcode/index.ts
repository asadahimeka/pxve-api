import { Hono } from 'hono'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'
// @ts-types="npm:@types/qrcode"
import QRCode from 'qrcode'

const QRCodeQuerySchema = z.object({
  text: z.string().min(1).meta({ description: '二维码内容', example: 'https://example.com' }),
  size: z.coerce.number().int().min(50).max(1000).default(200).meta({
    description: '二维码尺寸 (50-1000)',
    example: 200,
  }),
  encode: z.enum(['raw', 'base64']).meta({ description: '二维码返回方式' }).default('raw'),
  level: z.enum(['L', 'M', 'Q', 'H']).meta({ description: '二维码容错率' }).default('M'),
  bgcolor: z.string().default('#FFFFFF').meta({ description: '背景色', example: '#FFFFFF' }),
  fgcolor: z.string().default('#000000').meta({ description: '前景色', example: '#000000' }),
})

export const qrcodeRoute = new Hono()
  .get(
    '/qrcode',
    openApi({
      description: '生成二维码图片，重定向到 `/api/qrcode/`',
      tags: ['Image', 'HibiAPI Compat'],
      responses: { 301: z.object() },
    }),
    c => c.redirect(`/api/qrcode/?${new URLSearchParams(c.req.query())}`, 301)
  )
  .get(
    '/qrcode/',
    openApi({
      description: '生成二维码图片',
      tags: ['Image', 'HibiAPI Compat'],
      request: {
        query: QRCodeQuerySchema,
      },
      responses: {
        200: {
          description: '二维码图片',
          content: {
            'image/png': {},
            'text/plain': {},
          },
        },
        400: z.object({ error: z.string() }),
      },
    }),
    async c => {
      const { text, size, encode, level, bgcolor, fgcolor } = c.req.valid('query')

      // Generate QR code buffer
      try {
        const buffer = await QRCode.toBuffer(text, {
          errorCorrectionLevel: level || 'M',
          width: size,
          margin: 2,
          color: {
            dark: fgcolor,
            light: bgcolor,
          },
        })

        if (encode === 'base64') {
          return c.text(`data:image/png;base64,${buffer.toString('base64')}`, 200, {
            'Cache-Control': 'max-age=31536000',
          })
        }

        return new Response(new Uint8Array(buffer), {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'max-age=31536000',
          },
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return c.json({ error: msg }, 400)
      }
    }
  )
