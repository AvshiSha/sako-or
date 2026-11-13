import {
  BLOG_IMAGE_HEIGHT,
  BLOG_IMAGE_WIDTH,
  assessBlogImage,
  coverCropRect,
  type BlogImageVerdict,
} from '@/lib/blog-image-spec'

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

/**
 * Produce a blog editorial image at exactly 1200×628.
 *
 * Distinct from `resizeImageFile` above, which fits an image *inside* a box and
 * so turns a 2000×1000 source into 1200×600 — close to the target and not it.
 * The featured image is the hero on the article page and the picture on every
 * listing card; "about the right shape" is what produced a library at three
 * different sizes.
 *
 * The policy, the tolerance and the crop rectangle all come from
 * lib/blog-image-spec.ts, which the MCP upload path also reads, so an image
 * uploaded in the admin panel and the same image uploaded through the SEO
 * connector come out identical.
 *
 * Rejects rather than upscales. A source smaller than 1200×628 cannot become
 * one without inventing detail, and silently publishing a soft hero is worse
 * than telling the person holding the file.
 */
export async function resizeBlogEditorialImageFile(
  file: File,
  options: { allowCrop?: boolean } = {},
  quality = DEFAULT_QUALITY
): Promise<File> {
  if (typeof window === 'undefined') return file

  const bitmap = await loadImage(file)
  const source = { width: bitmap.naturalWidth, height: bitmap.naturalHeight }
  const assessment = assessBlogImage(source)

  if (assessment.verdict === 'too_small') {
    throw new BlogImageError(assessment.message, 'too_small')
  }
  if (assessment.verdict === 'crop' && !options.allowCrop) {
    throw new BlogImageError(assessment.message, 'crop')
  }
  if (assessment.verdict === 'exact') return file

  const rect = coverCropRect(source)
  const canvas = document.createElement('canvas')
  canvas.width = BLOG_IMAGE_WIDTH
  canvas.height = BLOG_IMAGE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new BlogImageError('This browser could not process the image.')

  ctx.drawImage(
    bitmap,
    rect.left,
    rect.top,
    rect.width,
    rect.height,
    0,
    0,
    BLOG_IMAGE_WIDTH,
    BLOG_IMAGE_HEIGHT
  )

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality)
  )
  if (!blob) throw new BlogImageError('This browser could not encode the resized image.')

  const baseName = file.name.replace(/\.[^.]+$/, '')
  return new File([blob], `${baseName}.webp`, { type: 'image/webp' })
}

/**
 * Carries a message written for the person at the upload button, and the
 * verdict behind it.
 *
 * The verdict is separate from the message because the caller has to branch on
 * it: only a `crop` can be retried with consent, and matching on the wording to
 * work that out would break the first time somebody improves the sentence.
 */
export class BlogImageError extends Error {
  constructor(
    message: string,
    readonly verdict: BlogImageVerdict | 'unsupported' = 'unsupported'
  ) {
    super(message)
    this.name = 'BlogImageError'
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new BlogImageError('That file could not be read as an image.'))
    }
    img.src = url
  })
}
