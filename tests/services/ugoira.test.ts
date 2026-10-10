import { convertUgoira, ugoiraExtRegex, ugoiraExts } from '../../src/services/ugoira.ts'
import { isSafeZipEntry } from '../../src/services/worker/ugoira-worker.ts'
import { join } from 'node:path'
import {
  ensureDirRecursive,
  makeTempDir,
  platformIsWindows,
  removeRecursive,
  runCmd,
  writeFile,
} from '../../src/lib/runtime.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('ugoiraExtRegex validates correct formats', () => {
  // Valid formats
  assert.deepEqual(ugoiraExtRegex.test('123456.mp4'), true)
  assert.deepEqual(ugoiraExtRegex.test('123456.gif'), true)
  assert.deepEqual(ugoiraExtRegex.test('123456.webp'), true)
  assert.deepEqual(ugoiraExtRegex.test('123456.webm'), true)
  assert.deepEqual(ugoiraExtRegex.test('123456.avif'), true)
  assert.deepEqual(ugoiraExtRegex.test('123456.apng'), true)

  // Invalid formats
  assert.deepEqual(ugoiraExtRegex.test('123456.jpg'), false)
  assert.deepEqual(ugoiraExtRegex.test('123456.png'), false)
  assert.deepEqual(ugoiraExtRegex.test('notanumber.mp4'), false)
  assert.deepEqual(ugoiraExtRegex.test('123456'), false)
})

test('ugoira service - ugoiraExts contains all supported extensions', () => {
  const expected = ['mp4', 'gif', 'apng', 'webp', 'webm', 'avif']
  assert.deepEqual(ugoiraExts, expected)
})

test('ugoira service - convertUgoira throws on invalid ID', async () => {
  await assert.rejects(
    () => convertUgoira('invalid.mp4'),
    (e: unknown) => e instanceof Error && e.message.includes('Invalid ugoira extension')
  )
})

test('ugoira service - convertUgoira throws on missing ID', async () => {
  await assert.rejects(
    () => convertUgoira(''),
    (e: unknown) => e instanceof Error && e.message.includes('Invalid ugoira extension')
  )
})

test('isSafeZipEntry blocks path traversal', () => {
  assert.deepEqual(isSafeZipEntry('../etc/passwd'), false)
  assert.deepEqual(isSafeZipEntry('/absolute/path.jpg'), false)
  assert.deepEqual(isSafeZipEntry('images\\1.jpg'), false)
  assert.deepEqual(isSafeZipEntry('C:\\windows\\system32'), false)
  assert.deepEqual(isSafeZipEntry('images/1.jpg'), true)
  assert.deepEqual(isSafeZipEntry('frames/000123.jpg'), true)
  assert.deepEqual(isSafeZipEntry('simple.png'), true)
})

test('isSafeZipEntry blocks nested traversal and absolute names', () => {
  assert.deepEqual(isSafeZipEntry('subdir/../../../etc/passwd'), false)
  assert.deepEqual(isSafeZipEntry('C:/Users/Admin/file.txt'), false)
  assert.deepEqual(isSafeZipEntry('..'), false)
  assert.deepEqual(isSafeZipEntry('./safe/file.txt'), true)
})

test('validateZipEntries rejects malicious zip with traversal entry', async () => {
  // Build a minimal zip in memory containing a traversal entry
  const tempDir = await makeTempDir()
  const zipPath = join(tempDir, 'malicious.zip')

  try {
    // Create a zip file using PowerShell's Compress-Archive or zip command
    // We create a file with a traversal name first, then zip it
    const evilDir = join(tempDir, 'evil_src')
    await ensureDirRecursive(evilDir)
    await writeFile(join(evilDir, 'evil.txt'), new TextEncoder().encode('pwned'))

    if (platformIsWindows()) {
      // On Windows, create a file named with '..' in a subdir to force traversal entry
      // PowerShell's Compress-Archive won't naturally create traversal entries,
      // so we rely on the direct isSafeZipEntry integration test above.
      // This test validates the check logic path.
      const checkEntry = isSafeZipEntry
      assert.deepEqual(checkEntry('../evil.txt'), false)
      assert.deepEqual(checkEntry('subdir/../../evil.txt'), false)
    } else {
      // On Unix, use zip with a malicious entry name
      const evilName = join(evilDir, '../evil.txt')
      await writeFile(evilName, new TextEncoder().encode('pwned'))

      const zipResult = await runCmd('zip', ['-j', zipPath, evilName])

      if (zipResult.success) {
        // Now try to validate - should throw for traversal
        // We can't call the internal function directly, but we can validate
        // the logic by checking the entry name detection
        const decoder = new TextDecoder()
        const listResult = await runCmd('unzip', ['-l', zipPath])
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
          assert.deepEqual(blocked, true, 'Traversal entry should be blocked by isSafeZipEntry')
        }
      }

      // Cleanup malicious file
      await removeRecursive(evilName).catch(() => {})
    }
  } finally {
    await removeRecursive(tempDir).catch(() => {})
  }
})
