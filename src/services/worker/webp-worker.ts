import sharp from 'sharp'

self.onmessage = async event => {
  const { inputBuffer, options = {} } = event.data

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

    self.postMessage({ status: 'success', data: compressedImage })
  } catch (error: any) {
    self.postMessage({ status: 'error', error: error.message })
  }
}
