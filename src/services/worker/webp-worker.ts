import { parentPort } from 'node:worker_threads'
import sharp from 'sharp'

// N workers share one libuv thread pool: cap each worker to avoid starvation.
sharp.concurrency(1)

// Registered only inside a real worker thread; main-thread imports skip it
// (parentPort is null outside a worker).
const port = parentPort
if (port) {
  port.on('message', async event => {
    const { inputBuffer, options = {} } = event

    try {
      const webpOpts = { quality: options.quality || 80 }
      let compressedImage
      if (options.width && options.height) {
        const width = Number(options.width)
        const height = Number(options.height)
        if (!width || !height) {
          throw new Error('Invalid width or height')
        }
        compressedImage = await sharp(new Uint8Array(inputBuffer))
          .resize({
            width,
            height,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp(webpOpts)
          .toBuffer()
      } else {
        compressedImage = await sharp(new Uint8Array(inputBuffer)).webp(webpOpts).toBuffer()
      }

      port.postMessage({ status: 'success', data: compressedImage })
    } catch (error: any) {
      port.postMessage({ status: 'error', error: error.message })
    }
  })
}
