import { ugoiraWorkerPool } from './worker/index.ts'
import type { UgoiraConvertExt } from './worker/ugoira-worker.ts'

const ugoiraMimeTypes: Record<UgoiraConvertExt, string> = {
  mp4: 'video/mp4',
  gif: 'image/gif',
  apng: 'image/apng',
  webp: 'image/webp',
  webm: 'video/webm',
  avif: 'image/avif',
}

export const ugoiraExts = Object.keys(ugoiraMimeTypes)
export const ugoiraExtRegex = new RegExp(`^\\d+\\.(${Object.keys(ugoiraMimeTypes).join('|')})$`)

export async function convertUgoira(ugoiraId: string, zip?: string, rate?: string) {
  if (!ugoiraExtRegex.test(ugoiraId)) throw new Error('Invalid ugoira extension')
  const [id, ext] = ugoiraId.split('.') as [string, UgoiraConvertExt]

  const result = await ugoiraWorkerPool.addTask({ id, zip, rate, ext })
  if (result.status !== 'success') {
    throw new Error(result.error)
  }

  const headers: Record<string, string> = {}
  headers['Content-Type'] = ugoiraMimeTypes[ext]
  headers['Content-Disposition'] = `inline; filename=${id}.${ext}`
  headers['Cache-Control'] = 'public, max-age=31536000, s-maxage=31536000'

  return {
    data: result.data,
    headers,
  }
}
