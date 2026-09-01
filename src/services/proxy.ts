import { MAX_DOWNLOAD_BYTES, PIXIV_COOKIE } from '@lib/const.ts'
import { assertSafeUrl } from '@lib/ssrf-guard.ts'

export async function commonProxy(req: Request) {
  const url = new URL(req.url)
  const target = url.pathname.replace('/proxy/', '') + url.search
  const reqUrl = await assertSafeUrl(target)

  const reqHeaders = new Headers(req.headers)
  const delHeaderKeys = [
    'host',
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'cf-visitor',
    'x-real-ip',
    'x-vercel-proxied-for',
    'cf-connecting-ip',
    'cdn-loop',
    'cf-ray',
    'x-vercel-ip-latitude',
    'x-vercel-forwarded-for',
    'forwarded',
    'x-vercel-id',
    'x-vercel-deployment-url',
    'x-forwarded-host',
    'x-vercel-ip-longitude',
    'x-forwarded-proto',
    'cf-ipcountry',
    'x-vercel-ip-country-region',
    'x-vercel-ip-timezone',
    'x-forwarded-for',
    'x-vercel-proxy-signature-ts',
    'x-vercel-ip-city',
    'x-vercel-ip-country',
    'x-vercel-proxy-signature',
    'x-middleware-invoke',
    'x-invoke-path',
    'x-invoke-query',
    'x-invoke-output',
    'x-forwarded-port',
  ]

  delHeaderKeys.forEach(key => {
    reqHeaders.delete(key)
  })

  if (reqUrl.hostname != 'yande.re') {
    reqHeaders.set('host', reqUrl.host)
    reqHeaders.set('origin', reqUrl.origin)
    reqHeaders.set('referer', reqUrl.origin + '/')
  }

  if (
    req.method.toUpperCase() == 'GET' &&
    reqUrl.hostname == 'www.pixiv.net' &&
    !reqUrl.search.includes('_anon=1') &&
    PIXIV_COOKIE
  ) {
    reqHeaders.set('cookie', PIXIV_COOKIE)
  }

  const resp = await fetch(new Request(reqUrl, req), { headers: reqHeaders })

  const contentLength = resp.headers.get('content-length')
  if (contentLength) {
    const parsed = Number(contentLength)
    if (!Number.isNaN(parsed) && parsed > MAX_DOWNLOAD_BYTES) {
      return new Response(null, { status: 413, statusText: 'Payload Too Large' })
    }
  }

  const respHeaders = new Headers(resp.headers)
  delHeaderKeys.forEach(key => {
    respHeaders.delete(key)
  })

  // const buffer = await resp.arrayBuffer()
  // if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
  //   return new Response(null, { status: 413, statusText: 'Payload Too Large' })
  // }

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: respHeaders,
  })
}
