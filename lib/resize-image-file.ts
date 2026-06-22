const DEFAULT_QUALITY = 0.85

/**
 * Resize image client-side to fit within max dimensions (shrink only).
 */
export async function resizeImageFile(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = DEFAULT_QUALITY
): Promise<File> {
  if (typeof window === 'undefined') return file

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width <= maxWidth && height <= maxHeight) {
        resolve(file)
        return
      }

      const ratio = Math.min(maxWidth / width, maxHeight / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      const outputType = file.type === 'image/png' ? 'image/webp' : file.type || 'image/jpeg'
      const baseName = file.name.replace(/\.[^.]+$/, '')
      const ext = outputType === 'image/webp' ? 'webp' : baseName.endsWith('.jpg') ? 'jpg' : 'jpeg'

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          const outName =
            outputType === 'image/webp' ? `${baseName}.webp` : file.name
          resolve(new File([blob], outName, { type: outputType }))
        },
        outputType,
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for resize'))
    }

    img.src = url
  })
}

/** Product photos: max 1200×1200, quality ~85%. */
export async function resizeProductImageFile(file: File): Promise<File> {
  return resizeImageFile(file, 1200, 1200, 0.85)
}
