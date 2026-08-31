import { join } from '@std/path'
import { ensureDir } from '@std/fs'
import { UA_HEADER } from '@lib/const.ts'
import { assertSafeUrl } from '@lib/ssrf-guard.ts'
import { pixivWebApi } from '../pixiv/web-api.ts'

export const UGOIRA_MAX_ZIP_BYTES = Number(Deno.env.get('UGOIRA_MAX_ZIP_BYTES') ?? 52428800)

/**
 * Validate that a zip entry name is safe (no path traversal).
 * Blocks "..", absolute paths, Windows drive letters, and backslash separators.
 */
export function isSafeZipEntry(name: string): boolean {
  return !name.includes('..') && !name.startsWith('/') && !name.includes(':') && !name.includes('\\')
}

export type UgoiraConvertExt = 'mp4' | 'gif' | 'apng' | 'webp' | 'webm' | 'avif'

self.onmessage = async (event) => {
  let { zip, rate, id, ext = 'avif' } = event.data

  try {
    if (!rate) rate = 16
    if (!zip) {
      ;({ zip, rate } = await getMetadata(id))
    }

    const buf = await downloadAndConvert(zip, rate, id, ext)

    self.postMessage({ status: 'success', data: buf })
  } catch (error: any) {
    self.postMessage({ status: 'error', error: error.message })
  }
}

async function getMetadata(id: number) {
  const data = await pixivWebApi.illustUgoiraMeta(id)
  const { frames = [], originalSrc = '' } = data as { frames: any[]; originalSrc: string }

  const totalMs = frames.reduce((acc, cur) => {
    acc += Number(cur.delay)
    return acc
  }, 0)
  const rate = (frames.length / totalMs) * 1000

  return { zip: originalSrc, rate }
}

async function downloadAndUnzip(zipUrl: string, outputDir: string) {
  const safeUrl = await assertSafeUrl(zipUrl)
  const response = await fetch(safeUrl, {
    headers: {
      Referer: 'https://www.pixiv.net/',
      ...UA_HEADER,
    },
    signal: AbortSignal.timeout(30000),
  })
  const zipData = new Uint8Array(await response.arrayBuffer())
  if (zipData.length > UGOIRA_MAX_ZIP_BYTES) {
    throw new Error(`zip too large: ${zipData.length} bytes exceeds limit of ${UGOIRA_MAX_ZIP_BYTES}`)
  }

  await ensureDir(outputDir)
  const zipPath = join(outputDir, 'ugoira.zip')
  await Deno.writeFile(zipPath, zipData)

  // Validate zip entries before extraction to prevent path traversal attacks
  await validateZipEntries(zipPath)

  let cmd = 'unzip'
  let args = ['-o', zipPath, '-d', outputDir]
  if (Deno.build.os === 'windows') {
    cmd = 'PowerShell'
    args = ['Expand-Archive', '-Path', `"${zipPath}"`, '-DestinationPath', `"${outputDir}"`, '-Force']
  }
  console.log(cmd, args.join(' '))
  const unzip = new Deno.Command(cmd, { args })

  const { success, stderr } = await unzip.output()
  console.log('unzip success: ', success)
  if (!success) {
    const decoder = new TextDecoder()
    console.error('unzip failed:', decoder.decode(stderr))
    throw new Error('unzip failed')
  }
}

/**
 * List zip entries and validate each one is safe before extraction.
 * Uses `zipinfo -1` on Unix or PowerShell list on Windows.
 */
async function validateZipEntries(zipPath: string) {
  let cmd: string
  let args: string[]

  if (Deno.build.os === 'windows') {
    cmd = 'PowerShell'
    args = [
      '-NoProfile',
      '-Command',
      `(Get-Item "${zipPath}").FullName | ForEach-Object { [System.IO.Compression.ZipFile]::OpenRead($_).Entries.FullName }`,
    ]
  } else {
    cmd = 'zipinfo'
    args = ['-1', zipPath]
  }

  const proc = new Deno.Command(cmd, { args, stdout: 'piped', stderr: 'piped' })
  const { success, stdout, stderr } = await proc.output()
  if (!success) {
    // Fallback: try unzip -l on systems without zipinfo
    const fallback = new Deno.Command('unzip', { args: ['-l', zipPath], stdout: 'piped', stderr: 'piped' })
    const fb = await fallback.output()
    if (!fb.success) {
      throw new Error('Failed to list zip entries')
    }
    const decoder = new TextDecoder()
    const lines = decoder.decode(fb.stdout).split('\n')
    // unzip -l format: lines with entries are indented, skip headers/footers
    // Name column starts at position 28 (after Length, Date, Time columns)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('---') || trimmed.startsWith('Length')) continue
      const name = trimmed.length > 28 ? line.slice(28).trim() : ''
      if (name && !name.endsWith('/')) {
        checkEntry(name)
      }
    }
    return
  }

  const decoder = new TextDecoder()
  const entries = decoder.decode(stdout).split('\n').filter((e) => e.trim())
  for (const entry of entries) {
    checkEntry(entry)
  }
}

function checkEntry(entryName: string) {
  if (!isSafeZipEntry(entryName)) {
    throw new Error(`unsafe zip entry: ${entryName}`)
  }
}

async function convertImages(imagesDir: string, outputFilePath: string, rate: string, ext: UgoiraConvertExt = 'avif') {
  const argsMap = {
    avif: `-y -r ${rate} -i ${imagesDir}/%06d.jpg -c:v libsvtav1 -pix_fmt yuv420p -crf 30 -b:v 0`
      .split(/\s+/)
      .concat([outputFilePath]),
    mp4: `-y -r ${rate} -i ${imagesDir}/%06d.jpg -c:v libx264 -pix_fmt yuv420p -vf pad=ceil(iw/2)*2:ceil(ih/2)*2`
      .split(/\s+/)
      .concat([outputFilePath]),
    gif:
      `-y -r ${rate} -i ${imagesDir}/%06d.jpg -filter_complex [0:v]scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=single[p];[b][p]paletteuse=dither=none`
        .split(/\s+/)
        .concat([outputFilePath]),
    apng: `-y -r ${rate} -i ${imagesDir}/%06d.jpg -c:v apng -plays 0 -vsync 0`.split(/\s+/).concat([outputFilePath]),
    webp:
      `-y -r ${rate} -i ${imagesDir}/%06d.jpg -vf scale=600:-1:force_original_aspect_ratio=decrease,fps=${rate} -loop 0 -compression_level 6 -quality 80 -preset picture`
        .split(/\s+/)
        .concat([outputFilePath]),
    webm: `-y -r ${rate} -i ${imagesDir}/%06d.jpg -c:v libvpx-vp9 -crf 28 -b:v 0 -pix_fmt yuv420p -vsync 0`
      .split(/\s+/)
      .concat([outputFilePath]),
  }
  const args = argsMap[ext]
  if (!args) throw new Error('Invalid extension')

  console.log('ffmpeg', args.join(' '))
  const ffmpeg = new Deno.Command('ffmpeg', { args })

  const { success, stderr, stdout } = await ffmpeg.output()
  const decoder = new TextDecoder()
  console.log('ffmpeg success: ', success, decoder.decode(stdout))
  if (!success) {
    console.error('FFmpeg failed:', decoder.decode(stderr))
    throw new Error('FFmpeg conversion failed')
  }
}

async function downloadAndConvert(zipUrl: string, rate: string, id: string, ext: UgoiraConvertExt = 'avif') {
  const tempDir = await Deno.makeTempDir()
  try {
    const imagesDir = join(tempDir, `images_${id}`)
    const outputFilePath = join(tempDir, `${id}.${ext}`)

    await downloadAndUnzip(zipUrl, imagesDir)
    await convertImages(imagesDir, outputFilePath, rate, ext)
    const data = await Deno.readFile(outputFilePath)

    return data
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => {})
  }
}
