import assert from 'node:assert/strict'
import { test } from 'node:test'
// tests/services/x-media-transaction.test.ts
import { type CheerioAPI, load } from 'cheerio'
import golden from './x-media/golden.json' with { type: 'json' }
import {
  animate,
  computeTransactionId,
  convertRotationToMatrix,
  Cubic,
  findOndemandUrl,
  floatToHex,
  get2DArray,
  getAnimationKey,
  parseKeyByteIndices,
  roundHalfEven,
  XClientTransaction,
} from '#services/x-media/transaction.ts'

interface GoldenVector {
  key: string
  keyBytes: number[]
  rowIndex: number
  keyByteIndices: number[]
  d: string
  frameRow: number[]
  targetTime: number
  animationKey: string
  calls: { method: string; path: string; timeNow: number; randomNum: number; transactionId: string }[]
}
const data = golden as unknown as {
  vectors: GoldenVector[]
  cubic: { curves: number[]; time: number; value: number }[]
}

test('roundHalfEven matches Python round()', () => {
  assert.deepEqual(roundHalfEven(2.5), 2)
  assert.deepEqual(roundHalfEven(3.5), 4)
  assert.deepEqual(roundHalfEven(96.5), 96)
  assert.deepEqual(roundHalfEven(-96.5), -96)
  assert.deepEqual(roundHalfEven(0.62745, 2), 0.63)
  assert.deepEqual(roundHalfEven(-0.96078, 2), -0.96)
  assert.deepEqual(roundHalfEven(0.039215, 2), 0.04)
  assert.deepEqual(roundHalfEven(2.675, 2), 2.67)
})

test('floatToHex matches Python float_to_hex', () => {
  assert.deepEqual(floatToHex(1), '1')
  // fork 用 chr(remainder + 55) → 大写 A-F；全小写是 animate() 里对 `0.` 开头的值做 .lower() 的效果
  assert.deepEqual(floatToHex(10.25), 'A.4')
  assert.deepEqual(floatToHex(0.5), '.8')
  assert.deepEqual(floatToHex(0), '')
  assert.deepEqual(floatToHex(2748), 'ABC')
})

test('Cubic matches Python golden', () => {
  for (const c of data.cubic) assert.deepEqual(new Cubic(c.curves).getValue(c.time), c.value)
})

for (const [i, g] of data.vectors.entries()) {
  test(`golden vector #${i}: get2DArray/animate/getAnimationKey`, () => {
    const html = `<html><head><meta name="twitter-site-verification" content="${g.key}"></head><body>${
      [0, 1, 2, 3].map((n) => `<svg id="loading-x-anim-${n}"><g><path></path><path d="${g.d}"></path></g></svg>`).join(
        '',
      )
    }</body></html>`
    const $: CheerioAPI = load(html)
    const kb = Uint8Array.from(g.keyBytes)
    const arr = get2DArray(kb, $)
    assert.deepEqual(arr[kb[g.rowIndex]! % 16], g.frameRow)
    assert.deepEqual(animate(g.frameRow, g.targetTime), g.animationKey)
    assert.deepEqual(getAnimationKey(kb, $, g.rowIndex, g.keyByteIndices), g.animationKey)
  })
  for (const call of g.calls) {
    test(`golden vector #${i}: transactionId ${call.method} t=${call.timeNow}`, async () => {
      const tid = await computeTransactionId(call.method, call.path, Uint8Array.from(g.keyBytes), g.animationKey, {
        timeNow: call.timeNow,
        randomNum: call.randomNum,
      })
      assert.deepEqual(tid, call.transactionId)
    })
  }
}

// ==== request-side (Task 3) ====
const ONDEMAND_JS = 'function f(a){return (a[2], 16)+(a[12], 16)+(a[14], 16)+(a[7], 16);}'

test('findOndemandUrl - two-step chunk map (fork strategy)', () => {
  const body = '...whatever...,123:"ondemand.s",...later...,123:"deadbeef01"...'
  assert.deepEqual(findOndemandUrl(body), 'https://abs.twimg.com/responsive-web/client-web/ondemand.s.deadbeef01a.js')
})

test('findOndemandUrl - inline format fallback (twitscraper strategy)', () => {
  const body = '{"ondemand.s":"cafe1234"}'
  assert.deepEqual(findOndemandUrl(body), 'https://abs.twimg.com/responsive-web/client-web/ondemand.s.cafe1234a.js')
})

test('findOndemandUrl - not found', () => {
  assert.deepEqual(findOndemandUrl('<html>nope</html>'), null)
})

test('parseKeyByteIndices - collects group(2) per match', () => {
  const { rowIndex, keyByteIndices } = parseKeyByteIndices(ONDEMAND_JS)
  assert.deepEqual(rowIndex, 2)
  assert.deepEqual(keyByteIndices, [12, 14, 7])
})

test('parseKeyByteIndices - empty throws', () => {
  assert.throws(
    () => parseKeyByteIndices('no indices here'),
    (e: unknown) => e instanceof Error && e.message.includes("Couldn't get KEY_BYTE indices")
  )
})

const g0 = data.vectors[0]!

/** Route-map fetch mock: [urlOrRegex, body][]. Records every call. */
function mockFetch(routes: [string | RegExp, string][]) {
  const calls: { url: string; init?: RequestInit }[] = []
  const impl = ((url: string | URL | Request, init?: RequestInit) => {
    const u = String(url)
    calls.push({ url: u, init })
    for (const [match, body] of routes) {
      if (typeof match === 'string' ? u === match : match.test(u)) {
        return Promise.resolve(new Response(body, { status: 200 }))
      }
    }
    return Promise.resolve(new Response('', { status: 404 }))
  }) as typeof fetch
  return { impl, calls }
}

const homeHtml = (key: string, d: string, withOndemand: boolean) =>
  `<html><head><meta name="twitter-site-verification" content="${key}"></head><body>${
    [0, 1, 2, 3]
      .map((n) => `<svg id="loading-x-anim-${n}"><g><path></path><path d="${d}"></path></g></svg>`)
      .join('')
  }${withOndemand ? '<script>...,123:"ondemand.s",...,123:"deadbeef01",...</script>' : ''}</body></html>`

test('XClientTransaction.create - full init chain (chunk-map page)', async () => {
  const { impl, calls } = mockFetch([
    ['https://x.com', homeHtml(g0.key, g0.d, true)],
    [/ondemand\.s/, ONDEMAND_JS],
  ])
  const ct = await XClientTransaction.create({ fetchImpl: impl })
  assert.deepEqual(calls.length, 2)
  assert.deepEqual(calls[1]!.url, 'https://abs.twimg.com/responsive-web/client-web/ondemand.s.deadbeef01a.js')
  const tid = await ct.generateTransactionId('GET', 'https://x.com/i/api/graphql/vFPc2LVIu7so2uA_gHQAdg/UserMedia', {
    timeNow: g0.calls[0]!.timeNow,
    randomNum: g0.calls[0]!.randomNum,
  })
  assert.deepEqual(tid, g0.calls[0]!.transactionId)
})

test('XClientTransaction.create - inline-format page fallback', async () => {
  const inlinePage = homeHtml(g0.key, g0.d, false).replace(
    '</body>',
    '<script>{"ondemand.s":"deadbeef01"}</script></body>',
  )
  const { impl, calls } = mockFetch([
    ['https://x.com', inlinePage],
    [/ondemand\.s/, ONDEMAND_JS],
  ])
  const ct = await XClientTransaction.create({ fetchImpl: impl })
  assert.deepEqual(calls[1]!.url, 'https://abs.twimg.com/responsive-web/client-web/ondemand.s.deadbeef01a.js')
  const tid = await ct.generateTransactionId('GET', 'https://x.com/i/api/graphql/vFPc2LVIu7so2uA_gHQAdg/UserMedia', {
    timeNow: g0.calls[0]!.timeNow,
    randomNum: g0.calls[0]!.randomNum,
  })
  assert.deepEqual(tid, g0.calls[0]!.transactionId)
})

test('XClientTransaction.create - follows meta-refresh migration', async () => {
  const finalPage = homeHtml(g0.key, g0.d, true)
  const refreshPage =
    '<html><head><meta http-equiv="refresh" content="0; url=https://x.com/x/migrate?tok=ENCD"/></head></html>'
  const { impl, calls } = mockFetch([
    ['https://x.com', refreshPage],
    [/migrate\?tok=/, finalPage],
    [/ondemand\.s/, ONDEMAND_JS],
  ])
  await XClientTransaction.create({ fetchImpl: impl })
  assert.deepEqual(calls.some((c) => c.url.includes('/migrate?tok=ENCD')), true)
})
