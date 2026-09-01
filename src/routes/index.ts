import { Hono } from 'hono'
import { ugoiraRoute } from './ugoira/index.ts'
import { aiImageDetectRoute } from './ai-image-detect/index.ts'
import { pixivApiRoute } from './pixiv/index.ts'
import { pixivApiProxyRoute } from './pixiv/app-api-proxy.ts'
import { hibiapiFallbackRoute } from './hibiapi-fallback/index.ts'
import { saucenaoRoute } from './saucenao/index.ts'
import { pixivTranslateNovelRoute } from './pixiv/novel-translate.ts'
import { pidRecoverRoute } from './pixiv/pid-recover.ts'
import { pixivWebApiRoute } from './pixiv/web-api.ts'
import { pixivNowRoute } from './pixiv/pixiv-now.ts'
import { pixivisionRoute } from './pixivision/index.ts'
import { pximgRoute } from './pximg/index.ts'
import { webpConvertRoute } from './webp/index.ts'
import { xMediaRoute } from './x-media/index.ts'
import { proxyRoute } from './cors-proxy/index.ts'

export const routes = new Hono()
  .get('/', c => c.html('<h2>Ciallo～(∠・ω< )⌒☆</h2><a href="/docs">API Document</a>'))
  .route('/api', ugoiraRoute)
  .route('/api', saucenaoRoute)
  .route('/api', pixivApiRoute)
  .route('/api', pidRecoverRoute)
  .route('/api', pixivTranslateNovelRoute)
  .route('/api', pixivisionRoute)
  .route('/api', pixivNowRoute)
  .route('/api', pixivWebApiRoute)
  .route('/api', webpConvertRoute)
  .route('/api', aiImageDetectRoute)
  .route('/api', xMediaRoute)
  .route('/', pximgRoute)
  .route('/', pixivApiProxyRoute)
  .route('/', hibiapiFallbackRoute)
  .route('/', proxyRoute)
