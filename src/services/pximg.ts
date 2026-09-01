import { UA_HEADER } from '@lib/const.ts'
import { callPixivAction } from './pixiv/action.ts'
import { pixivWebApi } from './pixiv/web-api.ts'
import { recoverPidImage } from './pixiv/pid-recover.ts'

export async function fetchPximg(path: string) {
  const resp = await fetch(`https://i.pximg.net${path}`, {
    headers: {
      Referer: 'https://www.pixiv.net/',
      ...UA_HEADER,
    },
  })

  if (!resp.ok) throw new Error('Response not ok.')

  return resp
}

export async function fetchPximgByPidPath(path: string) {
  const reg = /\/pid\/(\d+)(_(\d+)_?(s|m|l|o)?)?/
  const [_, id, __, partStr = '0', size = 'o'] = path.match(reg) || []
  if (!id) throw new Error('Invalid PID')
  const part = Number(partStr)
  let images = []
  let src = ''

  const getImgPath = (src: string) => src.replace('https://i.pximg.net', '')

  const appRes = await callPixivAction('illust', { id }).catch(() => null)
  if (appRes?.data) {
    const { illust } = appRes.data
    if (illust.meta_single_page.original_image_url) {
      images.push({
        s: getImgPath(illust.image_urls.square_medium),
        m: getImgPath(illust.image_urls.medium),
        l: getImgPath(illust.image_urls.large).replace(/\/c\/\d+x\d+(_\d+)?\//g, '/'),
        o: getImgPath(illust.meta_single_page.original_image_url),
      })
    } else {
      images = illust.meta_pages.map((e: any) => ({
        s: getImgPath(e.image_urls.square_medium),
        m: getImgPath(e.image_urls.medium),
        l: getImgPath(e.image_urls.large).replace(/\/c\/\d+x\d+(_\d+)?\//g, '/'),
        o: getImgPath(e.image_urls.original),
      }))
    }
    src = images[part]?.[size]
    if (src && !src.includes('common/images/limit')) {
      return fetchPximg(src)
    }
  }

  const webRes = await pixivWebApi.illustPages(+id).catch(() => null)
  if (webRes) {
    images = webRes.map(
      e =>
        ({
          s: getImgPath(e.urls.thumb_mini),
          m: getImgPath(e.urls.small),
          l: getImgPath(e.urls.regular),
          o: getImgPath(e.urls.original),
        }) as any
    )
    src = images[part]?.[size]
    if (src && !src.includes('common/images/limit')) {
      return fetchPximg(src)
    }
  }

  const recRes = await recoverPidImage(id).catch(() => null)
  if (recRes) {
    const recImages = JSON.parse(recRes)
    if (Array.isArray(recImages)) {
      images = recImages.map(e => {
        const o = e.fileUrl
        const m = e.sampleUrl || o
        return { s: m, m, l: o, o } as any
      })
      src = images[part]?.[size]
      if (src) return Response.redirect(src, 301)
    }
  }

  throw new Error('Image not found')
}
