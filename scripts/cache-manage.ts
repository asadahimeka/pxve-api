import { clearCache, deleteCacheEntry, getCacheStats } from '../src/middlewares/cache.ts'

async function main() {
  const action = prompt('Enter cache action[clear | delete | stats]:')
  if (!action) return
  switch (action) {
    case 'clear':
      {
        const name = prompt('Enter cache store name:')
        if (!name) return
        await clearCache(name)
        console.log('clearCache success')
      }
      break
    case 'delete':
      {
        const [name, key] =
          prompt('Enter cache store name and cache key (split by space):')?.split(/\s+/).filter(Boolean) || []
        if (!name || !key) return
        const success = await deleteCacheEntry(name, key)
        console.log('deleteCacheEntry success: ', success)
      }
      break
    case 'stats':
      {
        const name = prompt('Enter cache store name:')
        if (!name) return
        const stats = await getCacheStats(name)
        console.log('stats: ', stats)
      }
      break
    default:
      break
  }
}

main()
