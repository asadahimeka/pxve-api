import { MAX_DOWNLOAD_BYTES, SAUCENAO_API_KEY, UA_HEADER } from '@lib/const.ts'
import { assertSafeUrl } from '@lib/ssrf-guard.ts'

export async function saucenaoSearch(file: string | Blob) {
  if (!SAUCENAO_API_KEY) throw new Error('SAUCENAO_API_KEY is not set')

  const form = new FormData()
  form.set('api_key', SAUCENAO_API_KEY)
  form.set('output_type', '2')
  form.set('numres', '30')
  form.set('dedupe', '2')
  form.set('db', '999')

  if (typeof file == 'string') {
    await assertSafeUrl(file)
    const fileResp = await fetch(file)
    const contentLength = fileResp.headers.get('content-length')
    if (contentLength) {
      const parsed = Number(contentLength)
      if (!Number.isNaN(parsed) && parsed > MAX_DOWNLOAD_BYTES) {
        throw new Error('Payload Too Large')
      }
    }
    const blob = await fileResp.blob()
    if (blob.size > MAX_DOWNLOAD_BYTES) {
      throw new Error('Payload Too Large')
    }
    form.set('file', blob)
  } else {
    form.set('file', file)
  }

  const response = await fetch('https://saucenao.com/search.php', {
    method: 'POST',
    body: form,
    headers: {
      Origin: 'https://saucenao.com',
      Referer: 'https://saucenao.com/',
      ...UA_HEADER,
    },
  })

  return response
}
