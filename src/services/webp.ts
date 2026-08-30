import { UA_HEADER } from '@lib/const.ts'
import { assertSafeUrl } from '@lib/ssrf-guard.ts'
import { webpWorkerPool } from './worker/index.ts'

export async function convertWebP(url: string) {
  const reqUrl = new URL(url)
  const imgUrl = await assertSafeUrl(reqUrl.pathname.replace('/api/webp/', '') + reqUrl.search)

  if (!/\.(jpg|jpeg|png|webp)$/i.test(imgUrl.pathname)) throw new Error('Not supported')

  const width = imgUrl.searchParams.get('w')
  if (width) imgUrl.searchParams.delete('w')
  const height = imgUrl.searchParams.get('h')
  if (height) imgUrl.searchParams.delete('h')

  const imgResp = await fetch(imgUrl, { headers: UA_HEADER })
  if (!imgResp.ok) throw new Error('Response not ok.')

  const inputBuffer = await imgResp.arrayBuffer()
  const options = width && height ? { width, height } : {}

  const result = await webpWorkerPool.addTask({ inputBuffer, options })
  if (result.status !== 'success') {
    throw new Error(result.error)
  }

  const headers: Record<string, string> = {}
  headers['Content-Type'] = 'image/webp'
  headers['Cache-Control'] = 'max-age=31536000'

  return {
    data: result.data,
    headers,
  }
}
