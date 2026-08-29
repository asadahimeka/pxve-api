import { SAUCENAO_API_KEY, UA_HEADER } from '@lib/const.ts'

export async function saucenaoSearch(file: string | Blob) {
  if (!SAUCENAO_API_KEY) throw new Error('SAUCENAO_API_KEY is not set')

  const form = new FormData()
  if (typeof file == 'string') {
    form.append('file', await fetch(file).then(r => r.blob()))
  } else {
    form.append('file', file)
  }

  const url = new URL('https://saucenao.com/search.php')
  url.searchParams.append('api_key', SAUCENAO_API_KEY)
  url.searchParams.append('output_type', '2')
  url.searchParams.append('numres', '30')
  url.searchParams.append('dedupe', '2')
  url.searchParams.append('db', '999')

  const response = await fetch(url, {
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
