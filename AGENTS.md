# AGENTS.md - Development Guidelines for Pxve API

This document provides comprehensive guidelines for agentic coding agents working on the Pxve API project.

## Project Overview

Pxve API is a Deno-based web service that implements Pixiv-related APIs for the Pixiv Viewer frontend. It uses Hono framework and provides compatibility with HibiAPI while adding enhanced features like image processing, caching, and security measures.

## Build Commands

### Development Commands

```bash
# Development mode with hot reload
deno task dev

# Production mode
deno task start

# Type checking
deno task type-check

# Code formatting
deno task fmt

# Linting
deno task lint

# Cache management utility
deno task manage-cache

# Testing
deno task test                    # Run all tests
deno task test:watch             # Run tests in watch mode
```

### Testing

#### Test Structure

```
tests/
├── lib/                 # Core library tests
│   ├── request-deduper.test.ts
│   ├── worker-pool.test.ts
│   └── pixiv-api.test.ts
├── middlewares/          # Middleware tests
│   ├── logger.test.ts
│   ├── blocker.test.ts
│   └── cache.test.ts
├── services/            # Service layer tests
│   ├── proxy.test.ts
│   └── pixiv/
├── integration/         # Integration tests
│   ├── api.test.ts
│   └── routes.test.ts
└── utils/              # Test utilities
    └── test-helpers.ts
```

#### Running Tests

```bash
# Run all tests
deno task test

# Run specific test file
deno task test tests/lib/request-deduper.test.ts

# Run tests in watch mode for development
deno task test:watch

# Run tests with coverage (if needed)
deno test --coverage=coverage/
```

#### Test Environment

- Mock responses are used for external API calls
- Test utilities are provided in `tests/utils/test-helpers.ts`
- Tests run with necessary permissions (`--allow-all`)

#### Manual Testing

For manual API testing:

1. Use `deno task dev` to start development server
2. Test endpoints at http://localhost:3021/docs or http://localhost:3021/swagger
3. Use interactive Swagger UI for endpoint testing

## Code Style Guidelines

### Project Structure

```
src/
├── app.ts              # Application entry point
├── middlewares/        # Hono middleware functions
├── routes/            # API route handlers
├── services/          # Business logic and external API integrations
└── lib/               # Utility functions and core abstractions
```

### Import Conventions

```typescript
// Use absolute imports with aliases defined in deno.json
import { Hono } from 'hono'
import { PixivApi } from '@lib/pixiv-api.ts'
import { logger } from './middlewares/logger.ts'
import { callPixivAction } from '@services/pixiv/action.ts'
```

### TypeScript Configuration

- **Strict mode enabled** - All type violations are errors
- **Path aliases**: `@lib/` → `./src/lib/`, `@services/` → `./src/services/`
- **No unused variables**: Lint rule excluded (deno.json line 59)
- **Explicit any allowed**: Lint rule excluded (deno.json line 60)

### Formatting Rules (deno.json)

- **Line width**: 120 characters
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes
- **Semicolons**: Omitted
- **File extensions**: Always include `.ts` for imports

### Naming Conventions

```typescript
// Files: kebab-case
pixiv-api.ts, user-detail.ts, request-deduper.ts

// Functions: camelCase
async function callPixivAction() {}
function getUserDetail() {}

// Variables: camelCase
const pixivApi = new PixivApi()
const userName = 'example'

// Constants: UPPER_SNAKE_CASE for exports/constants
export const PIXIV_API_HEADERS = { ... }
export const ACCEPT_DOMAINS = []

// Classes: PascalCase
class PixivApi {}
class RequestDeduper {}

// Interfaces/Types: PascalCase
interface ApiResponse {}
type UserDetail = { ... }
```

### API Route Development

#### Route Structure Template

```typescript
import { Hono } from 'hono'
import { openApi } from 'hono-zod-openapi'
import z from 'zod'

export const route = new Hono()

route.get(
  '/endpoint',
  openApi({
    description: 'API endpoint description',
    tags: ['Category'],
    request: {
      query: z.object({
        param1: z.string().meta({ description: 'Parameter description' }),
        param2: z.number().optional(),
      }),
    },
    responses: {
      200: z.object({ data: z.any() }),
      500: z.object({ error: z.string() }),
    },
  }),
  async c => {
    const { param1, param2 } = c.req.valid('query')
    // Business logic here
    return c.json(result, 200)
  }
)
```

### Environment Variables & Constants

#### Required Environment Variables

- `PORT` (default: 3021)
- `PIXIV_COOKIE` (recommended)
- `PIXIV_ACCOUNT_TOKEN` (recommended)
- `PIXIV_ACCOUNT_TOKEN_ALTS` (optional, comma-separated)

#### Optional Environment Variables

- `ENABLE_CACHE` (1/0)
- `ACCEPT_DOMAINS` (comma-separated)
- `UA_BLACKLIST` (comma-separated)
- `HIBIAPI_BASE`
- `SAUCENAO_API_KEY`
- `SILICONClOUD_APT_KEY`
- `PROXY_ALLOW_DOMAINS` — allowed proxy domains (comma-separated, `*.domain` for subdomains)
- `PROXY_BLOCK_DOMAINS` — blocked proxy domains (comma-separated, `*.domain` for subdomains)
- `PROXY_BLOCK_PRIVATE` — block private/reserved IPs (default: 1)
- `MAX_DOWNLOAD_BYTES` — download size limit in bytes (default: 52428800 / 50MB)
- `UGOIRA_MAX_ZIP_BYTES` — ugoira ZIP size limit in bytes (default: 52428800 / 50MB)
- `API_TOKEN` — API access token; when set, only this token can access `/docs` paths

#### Usage Pattern

```typescript
// Always check for undefined values
const token = PIXIV_ACCOUNT_TOKEN
if (!token) {
  return Promise.reject(new Error('PIXIV_ACCOUNT_TOKEN required'))
}

// Use optional chaining for arrays
const altTokens = PIXIV_ACCOUNT_TOKEN_ALTS?.filter(e => e && e != token) || []
```

### API Integration Patterns

#### Pixiv API Integration

```typescript
// Use the PixivApi class with automatic token refresh
import { withPixivRefresh } from '@services/pixiv/action.ts'

async function getIllustDetail(id: string) {
  return withPixivRefresh(() => pixiv.illustDetail({ id }))
}

// For proxy requests, use the standardized headers
import { PIXIV_API_HEADERS } from '@lib/const.ts'

const headers = { ...PIXIV_API_HEADERS }
```

#### HTTP Client Patterns

```typescript
// Always use proper User-Agent headers
import { UA_HEADER } from '@lib/const.ts'

const response = await fetch(url, {
  headers: UA_HEADER,
  // Additional options
})

// Handle rate limiting explicitly
if (response.status === 429) {
  throw new Error('Rate Limit')
}
```

### Middleware Development

#### Logger Middleware Pattern

```typescript
export function customLogger(): MiddlewareHandler {
  return async (ctx, next) => {
    const start = new Date()
    await next()
    const time = `${Date.now() - start.valueOf()}ms`
    console.log(start.toLocaleString('zh'), ctx.req.method, ctx.res.status, time, ctx.req.url.slice(0, 150))
  }
}
```

#### Cache Integration

```typescript
// Use built-in cache for GET responses when enabled
if (!Deno.args.includes('--dev') && Deno.env.get('ENABLE_CACHE') == '1') {
  app.get(
    '*',
    cache({
      cacheName: 'pxve-api',
      cacheControl: 'max-age=600',
      maxAge: 600 * 1000,
      maxSizeBytes: 1024 * 1024 * 1024,
      cleanupInterval: 5 * 60 * 1000,
    })
  )
}
```

### Worker and Async Processing

For CPU-intensive operations like image processing:

```typescript
// Use worker pools for heavy operations
import { WorkerPool } from '@lib/worker-pool.ts'

const workerPool = new WorkerPool({
  workerScript: './worker.ts',
  maxWorkers: 4,
})

const result = await workerPool.addTask({
  // options
})
```

### Testing Guidelines

#### Manual Testing Approach

1. Start development server: `deno task dev`
2. Access Swagger UI: http://localhost:3021/swagger
3. Use interactive API documentation for testing
4. Monitor console logs for debugging

#### Debugging Tips

```typescript
// Use structured logging for debugging
console.log('[DEBUG]:', new Date().toLocaleString('zh'), 'operation', data)

// Use conditional debug logging
if (Deno.args.includes('--debug')) {
  console.log('[DEBUG]:', 'detailed info')
}
```

### Security Considerations

1. **Never log sensitive data** - tokens, cookies, credentials
2. **Validate all inputs** using Zod schemas
3. **Use CORS middleware** for cross-origin requests
4. **Implement rate limiting** for external API calls
5. **Sanitize error messages** before exposing to clients

### Performance Guidelines

1. **Use request deduplication** for identical concurrent requests
2. **Implement proper caching** for external API responses
3. **Use worker threads** for CPU-intensive operations
4. **Optimize image processing** with proper format selection
5. **Minimize external API calls** through intelligent caching

### Deployment Notes

- **Runtime**: Deno 2.x
- **Framework**: Hono with TypeScript
- **Process management**: Use `deno task start` for production
- **Port**: Default 3021, configurable via `PORT` environment variable
- **Docker**: Use provided Dockerfile for containerization

When making changes, always run `deno task fmt` and `deno task lint` before committing. For comprehensive checks, use `deno task type-check` to ensure type safety.
