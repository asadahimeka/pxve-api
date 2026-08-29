import type { MiddlewareHandler } from 'hono'

export function logger(): MiddlewareHandler {
  return async (ctx, next) => {
    const start = new Date()
    await next()
    const time = `${Date.now() - start.valueOf()}ms`
    ctx.res.headers.set('X-Response-Time', time)
    console.log(
      start.toLocaleString('zh'),
      ctx.req.method,
      ctx.res.status,
      time,
      ctx.req.url.slice(0, 150),
      ctx.req.header('User-Agent'),
      ctx.req.header('Origin')
    )
  }
}
