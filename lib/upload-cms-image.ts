import { storageService } from '@/lib/firebase'

const MAX_WIDTH = 1200
const MAX_HEIGHT = 628

/**
 * Resize image client-side to fit within max dimensions (shrink only).
 */
export async function resizeImageFile(
  file: File,
  maxWidth = MAX_WIDTH,
  maxHeight = MAX_HEIGHT
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
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          resolve(new File([blob], file.name, { type: file.type || 'image/jpeg' }))
        },
        file.type || 'image/jpeg',
        0.9
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for resize'))
    }

    img.src = url
  })
}

export async function uploadCmsImage(
  file: File,
  folder: 'blog' | 'categories',
  resize = false
): Promise<string> {
  const processed = resize ? await resizeImageFile(file) : file
  const ext = processed.name.split('.').pop() || 'jpg'
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
  return storageService.uploadImage(processed, fileName)
}
