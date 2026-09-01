import { proxy } from 'hono/proxy'
import { MAX_DOWNLOAD_BYTES, UA_HEADER } from '@lib/const.ts'
import { assertSafeUrl } from '@lib/ssrf-guard.ts'

export async function illuminartyImageAnalysis(url: string) {
  await assertSafeUrl(url)
  const imgResp = await fetch(url)

  const contentLength = imgResp.headers.get('content-length')
  if (contentLength) {
    const parsed = Number(contentLength)
    if (!Number.isNaN(parsed) && parsed > MAX_DOWNLOAD_BYTES) {
      throw new Error('Payload Too Large')
    }
  }

  const file = await imgResp.blob()
  if (file.size > MAX_DOWNLOAD_BYTES) {
    throw new Error('Payload Too Large')
  }
  const form = new FormData()
  form.append('file', file)

  const response = await proxy('https://app.illuminarty.ai/api/analysis/image', {
    method: 'POST',
    body: form,
    headers: {
      Origin: 'https://app.illuminarty.ai',
      Referer: 'https://app.illuminarty.ai/',
      ...UA_HEADER,
    },
  })

  return response
}

// export async function illuminartyImageAnalysis(url: string) {
//   const fileResp = await fetch(url)
//   if (!fileResp.ok) throw new Error('Fetch image error')

//   const api =
//     'https://ajax.thehive.ai/api/demo/classify?endpoint=ai_image_deepfake_frame_video_ai_audio&data_url=&hash=&image_url='
//   const form = new FormData()
//   form.append('media_type', 'photo')
//   form.append('model_type', 'ai_generated_and_deepfake_detection')
//   form.append('image', await fileResp.blob())

//   const response = await fetch(api, {
//     method: 'POST',
//     body: form,
//     headers: {
//       'accept': 'application/json, text/plain, */*',
//       'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-US;q=0.7,en-GB;q=0.6',
//       'origin': 'https://thehive.ai',
//       'priority': 'u=1, i',
//       'referer': 'https://thehive.ai/',
//       'sec-ch-ua': '"Microsoft Edge";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
//       'sec-ch-ua-mobile': '?0',
//       'sec-ch-ua-platform': '"Windows"',
//       'sec-fetch-dest': 'empty',
//       'sec-fetch-mode': 'cors',
//       'sec-fetch-site': 'same-site',
//       'sec-fetch-storage-access': 'active',
//       'x-forwarded-proto': 'https',
//       ...UA_HEADER,
//     },
//   })

//   return response
// }
