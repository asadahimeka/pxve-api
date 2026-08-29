// @ts-types="npm:@types/qs"
import { stringify } from 'qs'
import { parseCookie } from 'cookie'
import { load, type CheerioAPI } from 'cheerio'
import { PIXIV_COOKIE, UA_HEADER } from '@lib/const.ts'

export function objectToQueryString(queryParameters?: Record<string, any>) {
  if (!queryParameters) return ''
  return '?' + stringify(queryParameters, { arrayFormat: 'repeat' })
}

export async function request({
  method = 'get',
  path = '/',
  params,
  data,
  headers = {},
  specHeaders = {},
  returnText = false,
}: {
  method?: string
  path?: string
  params?: Record<string, any>
  data?: any
  headers?: Record<string, string>
  specHeaders?: Record<string, string>
  returnText?: boolean
}) {
  const url = new URL(path, 'https://www.pixiv.net')
  const cookies = parseCookie(headers.cookie || '')

  let isAnon = false
  if (params?._anon === '1') {
    isAnon = true
    delete params._anon
  }

  const reqUrl = url.href + objectToQueryString(params)
  const config: Record<string, any> = {
    method,
    body: data,
    headers: {
      'accept': 'application/json',
      'accept-language': 'zh-CN,zh;q=0.9',
      'accept-charset': 'UTF-8',
      ...UA_HEADER,

      // ↓ Keep these headers
      'host': 'www.pixiv.net',
      'origin': 'https://www.pixiv.net',
      'referer': 'https://www.pixiv.net/',

      ...specHeaders,
    },
  }

  if (!isAnon && (headers.cookie || PIXIV_COOKIE)) {
    config.headers.cookie = headers.cookie || PIXIV_COOKIE
  }

  if (headers['content-type']) {
    config.headers['content-type'] = headers['content-type']
  }

  if (headers['x-csrf-token'] || cookies.CSRFTOKEN) {
    config.headers['x-csrf-token'] = headers['x-csrf-token'] || cookies.CSRFTOKEN
  }

  if (headers['x-auth']) {
    config.headers.cookie = headers['x-auth']
  }

  const resp = await fetch(reqUrl, config)
  if (!resp.ok) {
    throw new Error('Response not ok.')
  }

  const resData = await resp[returnText ? 'text' : 'json']()
  return {
    data: resData?.body || resData,
  }
}

export function getSessionUserMeta(html: string) {
  const $ = load(html)
  const $legacyGlobalMeta = $('meta[name="global-data"]')
  const $nextDataScript = $('script#__NEXT_DATA__')

  let meta
  if ($legacyGlobalMeta.length > 0) {
    meta = resolveLegacyGlobalMeta($)
  } else if ($nextDataScript.length > 0) {
    meta = resolveNextData($)
  } else {
    throw new Error('未知的元数据类型')
  }

  return meta
}

function resolveLegacyGlobalMeta($: CheerioAPI) {
  const $meta = $('meta[name="global-data"]')
  if ($meta.length === 0 || !$meta.attr('content')) {
    throw new Error('无效的用户密钥')
  }

  let meta
  try {
    meta = JSON.parse($meta.attr('content')!)
  } catch (error) {
    throw new Error('解析元数据时出错')
  }

  if (!meta.userData) {
    throw new Error('无法获取登录状态')
  }

  return {
    userData: meta.userData,
    token: meta.token || '',
  }
}

function resolveNextData($: CheerioAPI) {
  const $nextDataScript = $('script#__NEXT_DATA__')
  if ($nextDataScript.length === 0) {
    throw new Error('无法获取元数据')
  }

  let nextData
  let preloadState
  try {
    nextData = JSON.parse($nextDataScript.text())
    preloadState = JSON.parse(nextData?.props?.pageProps?.serverSerializedPreloadedState)
  } catch (error) {
    throw new Error('解析元数据时出错')
  }

  const userData = preloadState?.userData?.self
  if (!userData) {
    throw new Error('意料外的元数据')
  }

  const token = preloadState?.api?.token || ''
  return { userData, token }
}
