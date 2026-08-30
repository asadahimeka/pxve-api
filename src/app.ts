import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { etag } from 'hono/etag'
import { prettyJSON } from 'hono/pretty-json'
import { secureHeaders } from 'hono/secure-headers'
import { serveStatic } from 'hono/deno'
import { createOpenApiDocument } from 'hono-zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { swaggerUI } from '@hono/swagger-ui'

import { RequestDeduper } from '@lib/request-deduper.ts'
import { toPublicError } from '@lib/sanitize.ts'
import { optionalAuth } from './middlewares/optional-auth.ts'
import { logger } from './middlewares/logger.ts'
import { rateLimit } from './middlewares/rate-limit.ts'
import { blocker, isAllowedOrigin } from './middlewares/blocker.ts'
import { cache } from './middlewares/cache.ts'
import { routes } from './routes/index.ts'

const app = new Hono()

app.use(logger())
app.use(rateLimit())
app.use(optionalAuth())
app.use(cors({ origin: (origin) => isAllowedOrigin(origin) ? origin : undefined, credentials: true }))
app.use(secureHeaders({ crossOriginResourcePolicy: 'same-site' }))
app.use(blocker())
app.get('*', etag())
app.use(prettyJSON())

if (!Deno.args.includes('--dev') && Deno.env.get('ENABLE_CACHE') == '1') {
  app.get(
    '*',
    cache({
      cacheName: 'pxve-api',
      cacheControl: 'max-age=600',
      maxAge: 600 * 1000, // 10min
      maxSizeBytes: 1024 * 1024 * 1024, // 1024MB
      maxEntries: Number(Deno.env.get('CACHE_MAX_ENTRIES') || '5000'),
      cleanupInterval: 5 * 60 * 1000, // 5min
    }),
  )
}

app.route('/', routes)

app.get('/robots.txt', serveStatic({ path: './public/robots.txt' }))
app.get('/favicon.ico', serveStatic({ path: './public/favicon.ico' }))

const description = /* markdown */ `
**API Service for [Pixiv Viewer](https://pixiv.pictures)**

一个实现了 Pixiv 相关站点的易用化 API 的程序，供 [Pixiv Viewer](https://github.com/asadahimeka/pixiv-viewer) 使用。

与 [HibiAPI](https://github.com/mixmoe/HibiAPI) 部分兼容。

A program that implements easy-to-use APIs for Pixiv-related websites, intended for use with the [Pixiv Viewer](https://github.com/asadahimeka/pixiv-viewer).

Partially compatible with HibiAPI.

*PxveAPI Documents* :
- [Scalar](/docs) (Easier to read and more beautiful)
- [Swagger UI](/swagger) (Integrated interactive testing function)

*HibiAPI Documents* :
- [Scalar](/docs/hibiapi) (Easier to read and more beautiful)
- [Swagger UI](/swagger/hibiapi) (Integrated interactive testing function)

*Project* :
- [asadahimeka/pxve-api](https://github.com/asadahimeka/pxve-api)
- [mixmoe/HibiAPI](https://github.com/mixmoe/HibiAPI)
`.trim()

createOpenApiDocument(
  app,
  { info: { title: 'Pxve API', version: '1.0.0', description } },
  { routeName: '/openapi.json' },
)

const cdn = 'https://fastly.jsdelivr.net/npm/@scalar/api-reference@1.43.11/dist/browser/standalone.js'
app.get('/openapi-hibiapi.json', serveStatic({ path: './public/openapi-hibiapi.json' }))
app.get('/docs', Scalar({ url: '/openapi.json', theme: 'elysiajs', pageTitle: 'Pxve API', cdn }))
app.get('/docs/hibiapi', Scalar({ url: '/openapi-hibiapi.json', theme: 'purple', pageTitle: 'HibiAPI', cdn }))
app.get('/swagger', swaggerUI({ url: '/openapi.json' }))
app.get('/swagger/hibiapi', swaggerUI({ url: '/openapi-hibiapi.json' }))

app.notFound((c) => c.json({ error: 'Not Found' }, 404))
app.onError((err, c) => {
  const pub = toPublicError(err)
  return c.json(pub, 500)
})

const deduper = new RequestDeduper()
const port = Number(Deno.env.get('PORT') ?? 3021)
Deno.serve(
  { hostname: '0.0.0.0', port },
  (req, ...args) => deduper.run(req.url, async () => await app.fetch(req, ...args)),
)

export { app }
