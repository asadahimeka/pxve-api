import { join } from '@std/path'
import { ensureDir } from '@std/fs'
import { UA_HEADER } from '@lib/const.ts'
import { pixivWebApi } from '../pixiv/web-api.ts'

export type UgoiraConvertExt = 'mp4' | 'gif' | 'apng' | 'webp' | 'webm' | 'avif'

self.onmessage = async event => {
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
  const response = await fetch(zipUrl, {
    headers: {
      Referer: 'https://www.pixiv.net/',
      ...UA_HEADER,
    },
  })
  const zipData = new Uint8Array(await response.arrayBuffer())

  await ensureDir(outputDir)
  const zipPath = join(outputDir, 'ugoira.zip')
  await Deno.writeFile(zipPath, zipData)

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

async function convertImages(imagesDir: string, outputFilePath: string, rate: string, ext: UgoiraConvertExt = 'avif') {
  const argsMap = {
    avif: `-y -r ${rate} -i ${imagesDir}/%06d.jpg -c:v libsvtav1 -pix_fmt yuv420p -crf 30 -b:v 0`
      .split(/\s+/)
      .concat([outputFilePath]),
    mp4: `-y -r ${rate} -i ${imagesDir}/%06d.jpg -c:v libx264 -pix_fmt yuv420p -vf pad=ceil(iw/2)*2:ceil(ih/2)*2`
      .split(/\s+/)
      .concat([outputFilePath]),
    gif: `-y -r ${rate} -i ${imagesDir}/%06d.jpg -filter_complex [0:v]scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=single[p];[b][p]paletteuse=dither=none`
      .split(/\s+/)
      .concat([outputFilePath]),
    apng: `-y -r ${rate} -i ${imagesDir}/%06d.jpg -c:v apng -plays 0 -vsync 0`.split(/\s+/).concat([outputFilePath]),
    webp: `-y -r ${rate} -i ${imagesDir}/%06d.jpg -vf scale=600:-1:force_original_aspect_ratio=decrease,fps=${rate} -loop 0 -compression_level 6 -quality 80 -preset picture`
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
  const imagesDir = join(tempDir, `images_${id}`)
  const outputFilePath = join(tempDir, `${id}.${ext}`)

  await downloadAndUnzip(zipUrl, imagesDir)
  await convertImages(imagesDir, outputFilePath, rate, ext)
  const data = await Deno.readFile(outputFilePath)
  await Deno.remove(tempDir, { recursive: true })

  return data
}
