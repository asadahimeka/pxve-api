import * as pixivWebApi from '@__dirname/pixiv-web-api'
import { PIXIV_COOKIE } from '@lib/const.ts'

pixivWebApi.setOptions({ acceptLanguage: 'zh-CN', cookie: PIXIV_COOKIE })

export { pixivWebApi }
