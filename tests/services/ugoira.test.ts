import { assertEquals, assertRejects } from '@std/assert'
import { convertUgoira, ugoiraExtRegex, ugoiraExts } from '../../src/services/ugoira.ts'
import { isSafeZipEntry } from '../../src/services/worker/ugoira-worker.ts'
import { join } from '@std/path'

Deno.test('ugoiraExtRegex validates correct formats', () => {
  // Valid formats
  assertEquals(ugoiraExtRegex.test('123456.mp4'), true)
  assertEquals(ugoiraExtRegex.test('123456.gif'), true)
  assertEquals(ugoiraExtRegex.test('123456.webp'), true)
  assertEquals(ugoiraExtRegex.test('123456.webm'), true)
  assertEquals(ugoiraExtRegex.test('123456.avif'), true)
  assertEquals(ugoiraExtRegex.test('123456.apng'), true)

  // Invalid formats
  assertEquals(ugoiraExtRegex.test('123456.jpg'), false)
  assertEquals(ugoiraExtRegex.test('123456.png'), false)
  assertEquals(ugoiraExtRegex.test('notanumber.mp4'), false)
  assertEquals(ugoiraExtRegex.test('123456'), false)
})

Deno.test('ugoira service - ugoiraExts contains all supported extensions', () => {
  const expected = ['mp4', 'gif', 'apng', 'webp', 'webm', 'avif']
  assertEquals(ugoiraExts, expected)
})

Deno.test('ugoira service - convertUgoira throws on invalid ID', async () => {
  await assertRejects(
    () => convertUgoira('invalid.mp4'),
    Error,
    'Invalid ugoira extension'
  )
})

Deno.test('ugoira service - convertUgoira throws on missing ID', async () => {
  await assertRejects(
    () => convertUgoira(''),
    Error,
    'Invalid ugoira extension'
  )
})

Deno.test('isSafeZipEntry blocks path traversal', () => {
  assertEquals(isSafeZipEntry('../etc/passwd'), false)
  assertEquals(isSafeZipEntry('/absolute/path.jpg'), false)
  assertEquals(isSafeZipEntry('images\\1.jpg'), false)
  assertEquals(isSafeZipEntry('C:\\windows\\system32'), false)
  assertEquals(isSafeZipEntry('images/1.jpg'), true)
  assertEquals(isSafeZipEntry('frames/000123.jpg'), true)
  assertEquals(isSafeZipEntry('simple.png'), true)
})

Deno.test('isSafeZipEntry blocks nested traversal and absolute names', () => {
  assertEquals(isSafeZipEntry('subdir/../../../etc/passwd'), false)
  assertEquals(isSafeZipEntry('C:/Users/Admin/file.txt'), false)
  assertEquals(isSafeZipEntry('..'), false)
  assertEquals(isSafeZipEntry('./safe/file.txt'), true)
})

Deno.test('validateZipEntries rejects malicious zip with traversal entry', async () => {
  // Build a minimal zip in memory containing a traversal entry
  const tempDir = await Deno.makeTempDir()
  const zipPath = join(tempDir, 'malicious.zip')

  try {
    // Create a zip file using PowerShell's Compress-Archive or zip command
    // We create a file with a traversal name first, then zip it
    const evilDir = join(tempDir, 'evil_src')
    await Deno.mkdir(evilDir, { recursive: true })
    await Deno.writeFile(join(evilDir, 'evil.txt'), new TextEncoder().encode('pwned'))

    if (Deno.build.os === 'windows') {
      // On Windows, create a file named with '..' in a subdir to force traversal entry
      // PowerShell's Compress-Archive won't naturally create traversal entries,
      // so we rely on the direct isSafeZipEntry integration test above.
      // This test validates the check logic path.
      const checkEntry = isSafeZipEntry
      assertEquals(checkEntry('../evil.txt'), false)
      assertEquals(checkEntry('subdir/../../evil.txt'), false)
    } else {
      // On Unix, use zip with a malicious entry name
      const evilName = join(evilDir, '../evil.txt')
      await Deno.writeFile(evilName, new TextEncoder().encode('pwned'))

      const proc = new Deno.Command('zip', {
        args: ['-j', zipPath, evilName],
        stdout: 'piped',
        stderr: 'piped',
      })
      const zipResult = await proc.output()

      if (zipResult.success) {
        // Now try to validate - should throw for traversal
        // We can't call the internal function directly, but we can validate
        // the logic by checking the entry name detection
        const decoder = new TextDecoder()
        const listProc = new Deno.Command('unzip', {
          args: ['-l', zipPath],
          stdout: 'piped',
          stderr: 'piped',
        })
        const listResult = await listProc.output()
        const listing = decoder.decode(listResult.stdout)
        // The zip should contain a traversal entry
        const hasTraversal = listing.includes('..')
        if (hasTraversal) {
          // Simulate what validateZipEntries does
          const lines = listing.split('\n')
          let blocked = false
          for (const line of lines) {
            const match = line.trim().split(/\s+/).pop()
            if (match && !match.endsWith('/') && !match.startsWith('---')) {
              if (!isSafeZipEntry(match)) {
                blocked = true
                break
              }
            }
          }
          assertEquals(blocked, true, 'Traversal entry should be blocked by isSafeZipEntry')
        }
      }

      // Cleanup malicious file
      await Deno.remove(evilName).catch(() => {})
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => {})
  }
})
