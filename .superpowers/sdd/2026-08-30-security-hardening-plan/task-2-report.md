# Task 2 Report: 限流与背压（Deduper/Worker/Cache）

**Date:** 2026-08-30
**Status:** ✅ COMPLETE

## Changes Made

### Created
- `src/middlewares/rate-limit.ts` — `rateLimit(opts?)` middleware with IP-based sliding window, configurable via env `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_ENABLED`
- `tests/middlewares/rate-limit.test.ts` — TDD test verifying 429 on exceeding max

### Modified
- `src/lib/request-deduper.ts` — Added `DEDUPER_MAX=1000` (env configurable) upper bound; throws `'Deduper queue full'` when exceeded
- `src/lib/worker-pool.ts` — Added `WORKER_QUEUE_MAX=200` (env configurable) upper bound; rejects with `'Worker queue full'` when exceeded
- `src/middlewares/cache.ts` — Added `maxEntries` option with LRU eviction; added `sanitizeUrl()` and auth-presence hash to cache key generation

## Verification
- `deno test --allow-all` on rate-limit, request-deduper, worker-pool tests: **6/6 passed**
- Git commit: `8791be5 feat(security): rate limit and bounded queues`

---

## Fix round 1 (ora-4 Important items)

**Commit:** `88c6f70 fix(security): rate-limit store cleanup + cache maxEntries wiring`

### Fix 1: rate-limit store unbounded growth + XFF spoofing
- **Problem:** `store` Map grew indefinitely; no cleanup of expired entries. `x-forwarded-for` header used directly, allowing trivial spoofing to bypass per-IP limits.
- **Changes to `src/middlewares/rate-limit.ts`:**
  - Added `cleanupStore(now)` — lazy cleanup called on every request: evicts entries where `resetAt < now`, then enforces `STORE_MAX=5000` cap by evicting oldest (smallest `resetAt`) entries.
  - Replaced `x-forwarded-for` + `x-real-ip` fallback with `x-real-ip` only (`c.req.header('x-real-ip') || 'unknown'`). `x-forwarded-for` is trivially spoofable by clients; `x-real-ip` is set by the reverse proxy.
  - Added `await` to `next()` calls to satisfy `deno lint require-await`.

### Fix 2: cache maxEntries dead code
- **Problem:** `cache.ts` supported `maxEntries` option with LRU eviction (lines 416-436), but `app.ts` never passed it — `CACHE_MAX_ENTRIES` env had no effect.
- **Changes to `src/app.ts`:**
  - Added `maxEntries: Number(Deno.env.get('CACHE_MAX_ENTRIES') || '5000')` to the `cache()` call. Default 5000 entries; env override supported.

### Verification
- `deno test --allow-all tests/middlewares/rate-limit.test.ts tests/lib/request-deduper.test.ts tests/lib/worker-pool.test.ts`: **6/6 passed**
- `deno lint src/middlewares/rate-limit.ts src/app.ts`: **0 errors** (new)
