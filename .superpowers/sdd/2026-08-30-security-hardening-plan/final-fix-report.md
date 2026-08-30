# Final Fix Wave Report

**Date**: 2026-08-30
**Scope**: Security hardening final review — blocking and important issues
**Commits**: 1 commit (single wave)

## Summary

Fixed all 5 issues identified in the final review diff (`review-0f830d1..3895667.diff`). All targeted tests pass; lint and fmt clean.

---

## C1 — CORS Integration Test Assertions

**Problem**: Two integration tests asserted legacy `ACAO='*'` or used `example.com` (not in ACCEPT_DOMAINS), causing CORS exact-match failures.

**Fix**:
- `tests/integration/api.test.ts`: Changed Origin from `https://example.com` to `https://pixiv.pictures`; assertion from `assertEquals(ACAO, '*')` to `assertEquals(ACAO, 'https://pixiv.pictures')`.
- `tests/integration/routes.test.ts`: Changed Origin to `https://pixiv.pictures`; assertion from `corsHeader !== null` to `assertEquals(corsHeader, 'https://pixiv.pictures')`.

**Tests**: `deno test --no-check tests/integration/api.test.ts tests/integration/routes.test.ts` — 11/11 passed.

---

## C2 — Rate Limiter Dead Code

**Problem**: `src/middlewares/rate-limit.ts` implemented but never mounted in `src/app.ts`.

**Fix**:
- `src/app.ts`: Added `import { rateLimit } from './middlewares/rate-limit.ts'` and `app.use(rateLimit())` after `logger()` and before `optionalAuth()`, matching the Spec architecture `Client → [RateLimit] → [OptionalAuth] → ...`.

**Tests**: `deno test --no-check tests/middlewares/rate-limit.test.ts` — 1/1 passed.

---

## I1 — SSRFGuard DNS Resolution Bypass

**Problem**: `assertSafeUrl` only checked literal IP patterns. DNS names like `nip.io` (resolving to private IPs) bypassed the guard.

**Fix**:
- `src/lib/ssrf-guard.ts`: Added `resolveAndCheck()` function that:
  - Detects non-literal-IP hostnames via `isLiteralIp()`.
  - Resolves both A and AAAA records via `Deno.resolveDns()` with a 2-second AbortController timeout.
  - Blocks on DNS failure or timeout (fail-closed).
  - Checks all resolved IPs against `isPrivateIp()` (which covers IPv4 private ranges, IPv6 loopback/ULA/link-local, and metadata IPs).
  - Caches DNS results per-hostname for 60 seconds (`DNS_CACHE_TTL_MS`).
- Extracted `isPrivateIp()` helper for reuse.
- Added `METADATA_HOSTS` constant.

**Tests**: `deno test --no-check tests/lib/ssrf-guard.test.ts` — 6/6 passed (existing tests unaffected; literal IPs skip DNS).

---

## I2 — SauceNAO SSRF via URL Fetch

**Problem**: `saucenaoSearch(string)` called `fetch(file)` without SSRF validation.

**Fix**:
- `src/services/saucenao.ts`: Added `import { assertSafeUrl }` and `await assertSafeUrl(file)` before `fetch(file)` for string inputs.
- `src/routes/saucenao/index.ts`: Added try/catch around both GET and POST handlers; `blocked*` errors return 400, other errors return 502.

**Tests**: `deno test --no-check tests/services/saucenao.test.ts` — 2/2 passed.

---

## I3 — RequestDeduper Log Leakage

**Problem**: `console.error(key)` logged raw URL containing sensitive query parameters (API keys, tokens).

**Fix**:
- `src/lib/request-deduper.ts`: Imported `sanitizeUrl` from `@lib/sanitize.ts`; changed `console.error(..., key, ...)` to `console.error(..., sanitizeUrl(key), ...)`.

**Tests**: `deno test --no-check tests/lib/request-deduper.test.ts` — 4/4 passed (log output now shows `https://example.com/api/error` without sensitive params).

---

## Verification

| Check | Result |
|-------|--------|
| `deno lint` (all modified files) | Clean |
| `deno fmt --check` (all modified files) | Clean (formatted) |
| Integration tests (C1) | 11/11 passed |
| Rate limit test (C2) | 1/1 passed |
| SSRF guard tests (I1) | 6/6 passed |
| SauceNAO tests (I2) | 2/2 passed |
| Deduper tests (I3) | 4/4 passed |
| **Total** | **24/24 passed** |

## Files Modified

| File | Issue | Change |
|------|-------|--------|
| `tests/integration/api.test.ts` | C1 | Origin → `pixiv.pictures`, assertion → exact match |
| `tests/integration/routes.test.ts` | C1 | Origin → `pixiv.pictures`, assertion → exact match |
| `src/app.ts` | C2 | Import + mount `rateLimit()` in middleware chain |
| `src/lib/ssrf-guard.ts` | I1 | DNS resolution with cache, `isPrivateIp`, `isLiteralIp` |
| `src/services/saucenao.ts` | I2 | `assertSafeUrl(file)` before fetch |
| `src/routes/saucenao/index.ts` | I2 | try/catch → 400/502 error mapping |
| `src/lib/request-deduper.ts` | I3 | `sanitizeUrl(key)` in error log |
