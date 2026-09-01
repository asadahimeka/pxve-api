import { revalidateCacheEntry } from '../src/middlewares/cache.ts'

async function main() {
  await revalidateCacheEntry(
    'cacheName', // your cache names
    'key', // specific a cache entry
    async () => {
      // function returns Response
      // e.g. doing a fetch
      const response = await fetch('https://example.com/some-url')
      return new Response(response.body, { status: 200, headers: {} })
    }
  )
}

main()
