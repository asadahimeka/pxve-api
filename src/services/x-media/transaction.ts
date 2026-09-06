// src/services/x-media/transaction.ts
import { type CheerioAPI, load } from 'cheerio'

export const DOMAIN = 'x.com'
export const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

const DEFAULT_KEYWORD = 'obfiowerehiring'
const ADDITIONAL_RANDOM_NUMBER = 3
const TOTAL_TIME = 4096
const EPOCH_OFFSET = 1682924400000

/**
 * Python round(): correctly-rounded decimal rounding (half-even) of the double's EXACT
 * binary value. The naive `value * 10**d` scaling trick misrounds when the product lands
 * on/over a .5 tie (2.675 * 100 === 267.5 exactly in IEEE 754, yet Python yields 2.67),
 * so the exact decimal quotient mant × 2^exp is computed with BigInt — bug-for-bug CPython parity.
 */
export function roundHalfEven(value: number, digits = 0): number {
  if (!Number.isFinite(value)) return value
  const d = Math.min(Math.max(Math.trunc(digits), 0), 22)
  const buf = new DataView(new ArrayBuffer(8))
  buf.setFloat64(0, value)
  const high = buf.getUint32(0)
  const low = buf.getUint32(4)
  const biased = (high & 0x7ff00000) >>> 20
  const negative = (high >>> 31) === 1
  let mant = (BigInt(high & 0xfffff) << 32n) | BigInt(low)
  let lsbExp = biased - 1075 // exact value = mant × 2^lsbExp
  if (biased === 0) lsbExp++ // subnormal: no implicit bit, lsb weight is 2^-1074
  else mant |= 1n << 52n
  if (mant === 0n) return value // ±0
  // half-even is sign-symmetric → round |value|, restore sign afterwards
  const pow10 = 10n ** BigInt(d)
  let k: bigint
  if (lsbExp >= 0) {
    k = (mant << BigInt(lsbExp)) * pow10 // integral value: no rounding
  } else {
    const den = 1n << BigInt(-lsbExp)
    const scaled = mant * pow10
    const q = scaled / den
    const twice = (scaled % den) << 1n
    if (twice > den) k = q + 1n
    else if (twice < den) k = q
    else k = q % 2n === 0n ? q : q + 1n // exact tie → even
  }
  return Number(negative ? -k : k) / Number(pow10)
}

/** Port of twikit x_client_transaction/utils.py float_to_hex (quirky loop preserved). */
export function floatToHex(x: number): string {
  const result: string[] = []
  let quotient = Math.trunc(x)
  let fraction = x - quotient
  let xx = x
  while (quotient > 0) {
    quotient = Math.trunc(xx / 16)
    const remainder = Math.trunc(xx - quotient * 16)
    result.unshift(remainder > 9 ? String.fromCharCode(remainder + 55) : String(remainder))
    xx = quotient
  }
  if (fraction === 0) return result.join('')
  result.push('.')
  while (fraction > 0) {
    fraction *= 16
    const integer = Math.trunc(fraction)
    fraction -= integer
    result.push(integer > 9 ? String.fromCharCode(integer + 55) : String(integer))
  }
  return result.join('')
}

function solve(value: number, minVal: number, maxVal: number, rounding: boolean): number {
  const result = (value * (maxVal - minVal)) / 255 + minVal
  return rounding ? Math.floor(result) : roundHalfEven(result, 2)
}

/** Port of x_client_transaction/cubic_curve.py Cubic. */
export class Cubic {
  constructor(readonly curves: number[]) {}

  getValue(time: number): number {
    let startGradient = 0.0
    let endGradient = 0.0
    let start = 0.0
    let mid = 0.0
    let end = 1.0
    if (time <= 0.0) {
      if (this.curves[0]! > 0.0) startGradient = this.curves[1]! / this.curves[0]!
      else if (this.curves[1] === 0.0 && this.curves[2]! > 0.0) startGradient = this.curves[3]! / this.curves[2]!
      return startGradient * time
    }
    if (time >= 1.0) {
      if (this.curves[2]! < 1.0) endGradient = (this.curves[3]! - 1.0) / (this.curves[2]! - 1.0)
      else if (this.curves[2] === 1.0 && this.curves[0]! < 1.0) {
        endGradient = (this.curves[1]! - 1.0) / (this.curves[0]! - 1.0)
      }
      return 1.0 + endGradient * (time - 1.0)
    }
    while (start < end) {
      mid = (start + end) / 2
      const xEst = cubicCalc(this.curves[0]!, this.curves[2]!, mid)
      if (Math.abs(time - xEst) < 0.00001) return cubicCalc(this.curves[1]!, this.curves[3]!, mid)
      if (xEst < time) start = mid
      else end = mid
    }
    return cubicCalc(this.curves[1]!, this.curves[3]!, mid)
  }
}

function cubicCalc(a: number, b: number, m: number): number {
  return 3.0 * a * (1 - m) * (1 - m) * m + 3.0 * b * (1 - m) * m * m + m * m * m
}

export function interpolate(fromList: number[], toList: number[], f: number): number[] {
  if (fromList.length !== toList.length) {
    throw new Error(`Mismatched interpolation arguments ${fromList}: ${toList}`)
  }
  return fromList.map((v, i) => v * (1 - f) + toList[i]! * f)
}

export function convertRotationToMatrix(rotation: number): number[] {
  const rad = (rotation * Math.PI) / 180
  return [Math.cos(rad), -Math.sin(rad), Math.sin(rad), Math.cos(rad)]
}

/** SVG frame rows used by the loading-x-anim animation, as int arrays. */
export function get2DArray(keyBytes: Uint8Array | number[], $: CheerioAPI): number[][] {
  const frames = $('[id^="loading-x-anim"]').toArray()
  const frame = frames[keyBytes[5]! % 4]
  if (!frame) throw new Error("Couldn't find loading-x-anim frames")
  const d = $(frame).children().eq(0).children().eq(1).attr('d')
  if (!d) throw new Error("Couldn't parse animation path 'd' attribute")
  return d.slice(9).split('C').map((seg) => (seg.match(/\d+/g) ?? []).map(Number))
}

/** Port of ClientTransaction.animate. */
export function animate(frames: number[], targetTime: number): string {
  const fromColor = [...frames.slice(0, 3), 1].map(Number)
  const toColor = [...frames.slice(3, 6), 1].map(Number)
  const fromRotation = [0.0]
  const toRotation = [solve(frames[6]!, 60.0, 360.0, true)]
  const rest = frames.slice(7)
  const curves = rest.map((item, counter) => solve(item, counter % 2 ? -1.0 : 0.0, 1.0, false))
  const val = new Cubic(curves).getValue(targetTime)
  const color = interpolate(fromColor, toColor, val).map((v) => (v > 0 ? v : 0))
  const rotation = interpolate(fromRotation, toRotation, val)
  const matrix = convertRotationToMatrix(rotation[0]!)
  const strArr: string[] = color.slice(0, -1).map((v) => roundHalfEven(v).toString(16))
  for (const value of matrix) {
    let rounded = roundHalfEven(value, 2)
    if (rounded < 0) rounded = -rounded
    const hexValue = floatToHex(rounded)
    if (hexValue.startsWith('.')) strArr.push(`0${hexValue}`.toLowerCase())
    else if (hexValue) strArr.push(hexValue)
    else strArr.push('0')
  }
  strArr.push('0', '0')
  return strArr.join('').replace(/[.-]/g, '')
}

/** Port of ClientTransaction.get_animation_key. */
export function getAnimationKey(
  keyBytes: Uint8Array | number[],
  $: CheerioAPI,
  rowIndex: number,
  keyByteIndices: number[],
): string {
  const row = keyBytes[rowIndex]! % 16
  const frameTime = keyByteIndices.reduce((acc, i) => acc * (keyBytes[i]! % 16), 1)
  const arr = get2DArray(keyBytes, $)
  const frameRow = arr[row]
  if (!frameRow || frameRow.length === 0) throw new Error(`animation frame row ${row} is empty`)
  return animate(frameRow, frameTime / TOTAL_TIME)
}

function b64Decode(key: string): Uint8Array {
  const bin = atob(key)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function b64Encode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

/** Port of ClientTransaction.generate_transaction_id (randomNum/timeNow injectable for tests). */
export async function computeTransactionId(
  method: string,
  path: string,
  keyBytes: Uint8Array | number[],
  animationKey: string,
  opts: { timeNow?: number; randomNum?: number } = {},
): Promise<string> {
  const timeNow = opts.timeNow ?? Math.floor((Date.now() - EPOCH_OFFSET) / 1000)
  const timeNowBytes = [0, 1, 2, 3].map((i) => (timeNow >> (i * 8)) & 0xff)
  const data = new TextEncoder().encode(`${method}!${path}!${timeNow}${DEFAULT_KEYWORD}${animationKey}`)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data))
  const randomNum = opts.randomNum ?? Math.floor(Math.random() * 256)
  const bytesArr = [...keyBytes, ...timeNowBytes, ...digest.slice(0, 16), ADDITIONAL_RANDOM_NUMBER]
  const out = new Uint8Array(bytesArr.length + 1)
  out[0] = randomNum
  for (let i = 0; i < bytesArr.length; i++) out[i + 1] = bytesArr[i]! ^ randomNum
  return b64Encode(out).replace(/=+$/, '')
}

// ==== request-side (Task 3) ====
const MIGRATION_URL_REGEX =
  /(http(?:s)?:\/\/(?:www\.)?(?:twitter|x){1}\.com(\/x)?\/migrate([\/?])?tok=[a-zA-Z0-9%\-_]+)+/
const ON_DEMAND_CHUNK_REGEX = /,(\d+):["']ondemand\.s["']/ // fork two-step: name map
const ON_DEMAND_INLINE_REGEX = /["']ondemand\.s["']\s*:\s*["']([\w-]*)["']/ // twitscraper fallback: inline map
// 与 fork transaction.py L24-25 逐字对应：外层 (…)+ 组 + 内层索引组，下方读取 match[2]
const INDICES_REGEX = /(\(\w{1}\[(\d{1,2})\],\s*16\))+/g

/**
 * Resolve the ondemand.s bundle URL from the x.com home page.
 * Strategy 1 (twikit fork, patched 2026-05-17): numeric chunk index in name map → hash in hash map.
 * Strategy 2 (twitscraper): inline "ondemand.s":"hash".
 * Returns null when neither format matches.
 */
export function findOndemandUrl(body: string): string | null {
  const chunk = ON_DEMAND_CHUNK_REGEX.exec(body)
  if (chunk) {
    const hash = new RegExp(`,${chunk[1]}:"([0-9a-f]+)"`).exec(body)
    if (hash) return `https://abs.twimg.com/responsive-web/client-web/ondemand.s.${hash[1]}a.js`
  }
  const inline = ON_DEMAND_INLINE_REGEX.exec(body)
  if (inline) return `https://abs.twimg.com/responsive-web/client-web/ondemand.s.${inline[1]}a.js`
  return null
}

/** Port of ClientTransaction.get_indices' regex extraction (group(2) per finditer match). */
export function parseKeyByteIndices(js: string): { rowIndex: number; keyByteIndices: number[] } {
  const indices: number[] = []
  let match: RegExpExecArray | null
  while ((match = INDICES_REGEX.exec(js)) !== null) indices.push(Number(match[2]))
  if (!indices.length) throw new Error("Couldn't get KEY_BYTE indices")
  return { rowIndex: indices[0]!, keyByteIndices: indices.slice(1) }
}

export interface XClientTransactionOptions {
  fetchImpl?: typeof fetch
  userAgent?: string
  language?: string
  /** x.com 登录态 cookies：访客首页不含 ondemand.s chunk map，init 必须带会话（与 Python 行为一致）。 */
  cookies?: Record<string, string>
}

/** Generates the X-Client-Transaction-Id header value. Init fetches x.com once per process. */
export class XClientTransaction {
  key = ''
  animationKey = ''
  private fetchImpl: typeof fetch
  private userAgent: string
  private language: string
  private cookies?: Record<string, string>

  constructor(opts: XClientTransactionOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch
    this.userAgent = opts.userAgent ?? DEFAULT_UA
    this.language = opts.language ?? 'en-US'
    this.cookies = opts.cookies
  }

  static async create(opts: XClientTransactionOptions = {}): Promise<XClientTransaction> {
    const ct = new XClientTransaction(opts)
    await ct.init()
    return ct
  }

  private ctHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept-Language': `${this.language},${this.language.split('-')[0]};q=0.9`,
      'Cache-Control': 'no-cache',
      Referer: `https://${DOMAIN}`,
      'User-Agent': this.userAgent,
    }
    if (this.cookies && Object.keys(this.cookies).length > 0) {
      headers.Cookie = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ')
    }
    return headers
  }

  async init(): Promise<void> {
    const res = await this.fetchImpl(`https://${DOMAIN}`, { headers: this.ctHeaders() })
    const html = await this.handleMigration(await res.text())
    const $ = load(html)
    const key = $('meta[name="twitter-site-verification"]').attr('content')
    if (!key) throw new Error("Couldn't get key from the page source")
    this.key = key
    const ondemandUrl = findOndemandUrl(html)
    if (!ondemandUrl) throw new Error("Couldn't get KEY_BYTE indices")
    const js = await (await this.fetchImpl(ondemandUrl, { headers: this.ctHeaders() })).text()
    const { rowIndex, keyByteIndices } = parseKeyByteIndices(js)
    this.animationKey = getAnimationKey(b64Decode(key), $, rowIndex, keyByteIndices)
  }

  /** Port of handle_x_migration: meta-refresh redirect then form[name=f] POST. */
  private async handleMigration(html: string): Promise<string> {
    const formAction = `https://${DOMAIN}/x/migrate`
    const refresh = load(html)('meta[http-equiv="refresh"]').toString()
    const match = MIGRATION_URL_REGEX.exec(refresh) ?? MIGRATION_URL_REGEX.exec(html)
    let pageHtml = html
    if (match) pageHtml = await (await this.fetchImpl(match[0], { headers: this.ctHeaders() })).text()
    const $ = load(pageHtml)
    const form = $("form[name='f']").length ? $("form[name='f']") : $(`form[action='${formAction}']`)
    if (form.length) {
      const action = form.attr('action') ?? formAction
      const payload: Record<string, string> = {}
      form.find('input').each((_, el) => {
        const name = $(el).attr('name')
        if (name) payload[name] = $(el).attr('value') ?? ''
      })
      pageHtml = await (
        await this.fetchImpl(`${action}/?mx=2`, {
          method: 'POST',
          headers: { ...this.ctHeaders(), 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(payload).toString(),
        })
      ).text()
    }
    return pageHtml
  }

  generateTransactionId(
    method: string,
    url: string,
    opts: { timeNow?: number; randomNum?: number } = {},
  ): Promise<string> {
    return computeTransactionId(method, new URL(url).pathname, b64Decode(this.key), this.animationKey, opts)
  }
}

// Python 版每请求（每进程）重新 init；X 会随前端发布滚动 ondemand.s/key，
// 长驻进程的单例需加 TTL，过期后下一次请求重建（审查记录 2 advisory #1）。
const SHARED_TRANSACTION_TTL_MS = 6 * 60 * 60 * 1000
let shared: Promise<XClientTransaction> | null = null
let sharedAt = 0
export function getSharedTransaction(opts?: XClientTransactionOptions): Promise<XClientTransaction> {
  if (!shared || Date.now() - sharedAt > SHARED_TRANSACTION_TTL_MS) {
    sharedAt = Date.now()
    shared = XClientTransaction.create(opts).catch((err) => {
      shared = null // allow retry on next request
      throw err
    })
  }
  return shared
}
