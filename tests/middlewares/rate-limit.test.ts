import { Hono } from 'hono'
import { rateLimit } from '../../src/middlewares/rate-limit.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TestEnvironment } from '../utils/test-helpers.ts'

function createApp(max = 3) {
  const app = new Hono()
  app.use(rateLimit({ max, windowMs: 60_000 }))
  app.get('/t', c => c.text('ok'))
  return app
}

async function fire(app: Hono, headers: Record<string, string>): Promise<number> {
  const res = await app.request('/t', { headers })
  return res.status
}

// 原有基础用例（保留自本文件旧版本）
test('rate limit 429', async () => {
  const app = new Hono()
  app.use(rateLimit({ windowMs: 60000, max: 2 }))
  app.get('/', c => c.text('ok'))
  await (await app.request('/')).text()
  await (await app.request('/')).text()
  const r3 = await app.request('/')
  assert.deepEqual(r3.status, 429)
})

test('rate-limit - without TRUST_* flags, spoofed proxy headers are ignored', async () => {
  const env = new TestEnvironment()
  env.setEnv('TRUST_CLOUDFLARE', 'false')
  env.setEnv('TRUST_PROXY', 'false')
  const app = createApp(3)
  try {
    const statuses: number[] = []
    for (let i = 0; i < 10; i++) {
      statuses.push(await fire(app, { 'x-real-ip': `10.20.${i}.1`, 'x-forwarded-for': `10.30.${i}.1, 10.40.${i}.1` }))
    }
    const ok = statuses.filter(s => s === 200).length
    const limited = statuses.filter(s => s === 429).length
    assert.equal(ok <= 3, true, `expected at most 3 requests allowed, got ${ok} (headers must not create separate buckets)`)
    assert.equal(limited >= 1, true, 'expected rate limit to kick in when proxy headers are untrusted')
  } finally {
    env.cleanup()
  }
})

test('rate-limit - TRUST_PROXY=true uses x-real-ip for bucketing', async () => {
  const env = new TestEnvironment()
  env.setEnv('TRUST_CLOUDFLARE', 'false')
  env.setEnv('TRUST_PROXY', 'true')
  const app = createApp(3)
  try {
    // rotating x-real-ip -> separate buckets -> all pass
    for (let i = 0; i < 6; i++) {
      const s = await fire(app, { 'x-real-ip': `10.50.${i}.1` })
      assert.equal(s, 200, `request ${i} with unique x-real-ip should pass`)
    }
    // same x-real-ip -> single bucket -> 429 after max
    const statuses: number[] = []
    for (let i = 0; i < 5; i++) {
      statuses.push(await fire(app, { 'x-real-ip': '10.50.99.1' }))
    }
    assert.equal(statuses.filter(s => s === 429).length >= 1, true, 'repeated same x-real-ip should hit the limit')
  } finally {
    env.cleanup()
  }
})

test('rate-limit - TRUST_PROXY=true buckets XFF by rightmost segment', async () => {
  const env = new TestEnvironment()
  env.setEnv('TRUST_CLOUDFLARE', 'false')
  env.setEnv('TRUST_PROXY', 'true')
  const app = createApp(3)
  try {
    // rightmost fixed, leftmost rotating -> must be ONE bucket -> 429 after max
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      statuses.push(await fire(app, { 'x-forwarded-for': `9.9.${i}.9, 10.77.0.1` }))
    }
    const ok = statuses.filter(s => s === 200).length
    const limited = statuses.filter(s => s === 429).length
    assert.equal(ok <= 3, true, `varying leftmost XFF segment must not bypass the limit, got ${ok} allowed`)
    assert.equal(limited >= 1, true, 'fixed rightmost XFF segment should hit the limit')
  } finally {
    env.cleanup()
  }
})

test('rate-limit - TRUST_PROXY=true with rotating rightmost XFF gets separate buckets', async () => {
  const env = new TestEnvironment()
  env.setEnv('TRUST_CLOUDFLARE', 'false')
  env.setEnv('TRUST_PROXY', 'true')
  const app = createApp(3)
  try {
    for (let i = 0; i < 6; i++) {
      const s = await fire(app, { 'x-forwarded-for': `1.1.1.1, 10.66.${i}.2` })
      assert.equal(s, 200, `request ${i} with unique rightmost XFF segment should pass`)
    }
  } finally {
    env.cleanup()
  }
})

test('rate-limit - TRUST_CLOUDFLARE=true uses cf-connecting-ip and ignores other proxy headers', async () => {
  const env = new TestEnvironment()
  env.setEnv('TRUST_CLOUDFLARE', 'true')
  env.setEnv('TRUST_PROXY', 'false')
  const app = createApp(3)
  try {
    // rotating cf-connecting-ip with hostile headers -> separate buckets -> all pass
    for (let i = 0; i < 6; i++) {
      const s = await fire(app, {
        'cf-connecting-ip': `2.2.${i}.3`,
        'x-real-ip': `10.60.${i}.1`,
        'x-forwarded-for': `10.61.${i}.1, 10.62.${i}.1`,
      })
      assert.equal(s, 200, `request ${i} with unique cf-connecting-ip should pass`)
    }
    // same cf-connecting-ip -> single bucket -> 429 after max
    const statuses: number[] = []
    for (let i = 0; i < 5; i++) {
      statuses.push(await fire(app, { 'cf-connecting-ip': '2.2.99.3', 'x-real-ip': `10.63.${i}.1` }))
    }
    assert.equal(statuses.filter(s => s === 429).length >= 1, true, 'repeated same cf-connecting-ip should hit the limit')
  } finally {
    env.cleanup()
  }
})
