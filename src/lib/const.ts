const getCommaSplitVals = (str?: string) => {
  return (
    str
      ?.trim()
      ?.split(',')
      ?.map(s => s.trim())
      ?.filter(Boolean) || []
  )
}

export const GET_API_TOKEN = () => Deno.env.get('API_TOKEN')?.trim()
export const GET_ACCEPT_DOMAINS = () => getCommaSplitVals(Deno.env.get('ACCEPT_DOMAINS'))
export const UA_BLACKLIST = getCommaSplitVals(Deno.env.get('UA_BLACKLIST'))
export const MAX_DOWNLOAD_BYTES = Number(Deno.env.get('MAX_DOWNLOAD_BYTES') ?? 52428800) || 52428800

export const PIXIV_COOKIE = Deno.env.get('PIXIV_COOKIE')?.trim()
export const PIXIV_ACCOUNT_TOKEN = Deno.env.get('PIXIV_ACCOUNT_TOKEN')?.trim()
export const PIXIV_ACCOUNT_TOKEN_ALTS = getCommaSplitVals(Deno.env.get('PIXIV_ACCOUNT_TOKEN_ALTS'))

export const PIXIV_API_HEADERS = {
  'App-OS': 'Android',
  'App-OS-Version': 'Android 16.0',
  'App-Version': '6.194.0',
  'Accept-Language': 'zh-CN',
  'User-Agent': 'PixivAndroidApp/6.194.0 (Android 16.0; Pixel 9)',
}

export const UA_HEADER = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
}

export const HIBIAPI_BASE = Deno.env.get('HIBIAPI_BASE')?.trim()
export const SAUCENAO_API_KEY = Deno.env.get('SAUCENAO_API_KEY')?.trim()
export const SILICONClOUD_APT_KEY = Deno.env.get('SILICONClOUD_APT_KEY')?.trim()
