import { serve } from '@hono/node-server'
import { app } from './app.ts'
import { RequestDeduper } from '#lib/request-deduper.ts'
import { getNumberEnv } from '#lib/runtime.ts'

const deduper = new RequestDeduper()
const port = getNumberEnv('PORT', 3021)

// Same semantics as before: GET requests without auth headers share
// auth headers share in-flight upstream fetches via RequestDeduper.
function dedupedFetch(req: Request, ...args: any[]) {
  const skipDeduper = Boolean(
    req.method.toUpperCase() != 'GET' ||
    req.headers.get('authorization') ||
    req.headers.get('x-auth') ||
    req.headers.get('cookie')?.includes('PHPSESSID')
  )
  return skipDeduper ? app.fetch(req, ...args) : deduper.run(req.url, async () => await app.fetch(req, ...args))
}

serve({ hostname: '0.0.0.0', port, fetch: dedupedFetch }, info => {
  console.log(`pxve-api listening on http://localhost:${info.port}`)
})
