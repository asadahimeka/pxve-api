import { join } from '@std/path'

const fetch_x_media_py = join(import.meta.dirname!, 'fetch_x_media.py')

/** Max concurrent x-media Python processes */
const X_MEDIA_MAX_CONCURRENCY = Number(Deno.env.get('X_MEDIA_MAX_CONCURRENCY') ?? 2)
let activeXMedia = 0
const waitQueue: (() => void)[] = []

async function acquireSlot(): Promise<void> {
  if (activeXMedia < X_MEDIA_MAX_CONCURRENCY) {
    activeXMedia++
    return
  }
  return new Promise<void>(resolve => {
    waitQueue.push(resolve)
  })
}

function releaseSlot(): void {
  activeXMedia--
  if (waitQueue.length > 0) {
    activeXMedia++
    waitQueue.shift()!()
  }
}

const userNameRe = /^[A-Za-z0-9_]{1,15}$/
const cursorRe = /^[A-Za-z0-9_\-=+/]{1,64}$/

export async function runFetchXMediaCmd(userName?: string, userId?: string, nextCursor?: string) {
  if (!userName && !userId) {
    throw new Error('`userName` or `userId` is required.')
  }
  if (userName && !userNameRe.test(userName)) {
    throw new Error('`userName` must be 1-15 alphanumeric/underscore characters.')
  }
  if (userId && !/^\d+$/.test(userId)) {
    throw new Error('`userId` should be numeric.')
  }
  if (nextCursor && !cursorRe.test(nextCursor)) {
    throw new Error('`nextCursor` must be 1-64 alphanumeric/underscore/hyphen/base64 characters.')
  }

  await acquireSlot()
  try {
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
  } finally {
    releaseSlot()
  }
}
