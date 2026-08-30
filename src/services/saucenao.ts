import { SAUCENAO_API_KEY, UA_HEADER } from '@lib/const.ts'

export async function saucenaoSearch(file: string | Blob) {
  if (!SAUCENAO_API_KEY) throw new Error('SAUCENAO_API_KEY is not set')

  const form = new FormData()
  form.set('api_key', SAUCENAO_API_KEY)
  form.set('output_type', '2')
  form.set('numres', '30')
  form.set('dedupe', '2')
  form.set('db', '999')

  if (typeof file == 'string') {
    form.set('file', await fetch(file).then(r => r.blob()))
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
