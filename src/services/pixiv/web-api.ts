import * as pixivWebApi from '#lib/pixiv-web-api.ts'
import { PIXIV_COOKIE } from '#lib/const.ts'

pixivWebApi.setOptions({ acceptLanguage: 'zh-CN', cookie: PIXIV_COOKIE })

export { pixivWebApi }
