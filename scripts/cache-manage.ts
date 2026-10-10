import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { clearCache, deleteCacheEntry, getCacheStats } from '../src/middlewares/cache.ts'

const rl = createInterface({ input: process.stdin, output: process.stdout })

async function main() {
  try {
    const action = await rl.question('Enter cache action[clear | delete | stats]:')
    if (!action) return
    switch (action) {
      case 'clear':
        {
          const name = await rl.question('Enter cache store name:')
          if (!name) return
          await clearCache(name)
          console.log('clearCache success')
        }
        break
      case 'delete':
        {
          const [name, key] =
            (await rl.question('Enter cache store name and cache key (split by space):'))?.split(/\s+/).filter(
              Boolean
            ) || []
          if (!name || !key) return
          const success = await deleteCacheEntry(name, key)
          console.log('deleteCacheEntry success: ', success)
        }
        break
      case 'stats':
        {
          const name = await rl.question('Enter cache store name:')
          if (!name) return
          const stats = await getCacheStats(name)
          console.log('stats: ', stats)
        }
        break
      default:
        break
    }
  } finally {
    rl.close()
  }
}

main()
