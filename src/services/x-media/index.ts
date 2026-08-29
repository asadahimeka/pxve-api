import { join } from '@std/path'

const fetch_x_media_py = join(import.meta.dirname!, 'fetch_x_media.py')
export async function runFetchXMediaCmd(userName?: string, userId?: string, nextCursor?: string) {
  if (!userName && !userId) {
    throw new Error('`userName` or `userId` is required.')
  }
  if (userId && !/^\d+$/.test(userId)) {
    throw new Error('`userId` should be numeric.')
  }

  const args = [
    userName && ['--user', userName],
    userId && ['--userid', userId],
    nextCursor && ['--cursor', nextCursor],
  ]
    .flat()
    .filter(Boolean) as string[]

  const command = new Deno.Command('python', { args: [fetch_x_media_py, ...args] })

  const { success, stderr, stdout } = await command.output()
  const decoder = new TextDecoder()
  if (!success) {
    console.error('Run fetch_x_media cmd failed:', decoder.decode(stderr))
    throw new Error('Run fetch_x_media cmd failed')
  }

  const res = decoder.decode(stdout)
  return JSON.parse(res)
}
