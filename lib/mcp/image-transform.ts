import 'server-only'

import sharp from 'sharp'

import {
  BLOG_IMAGE_HEIGHT,
  BLOG_IMAGE_WIDTH,
  assessBlogImage,
  coverCropRect,
  requiresCropConsent,
  type BlogImageAssessment,
} from '@/lib/blog-image-spec'
import { McpValidationError } from '@/lib/mcp/validation'

/**
 * Measuring and conforming an uploaded image, server side.
 *
 * The MCP upload path stored whatever bytes it was handed and never looked at
 * the dimensions. That worked only because the editor happened to be exporting
 * at the right size -- there was nothing making it true, no way to find out
 * from the tool response what had actually been stored, and no error when a
 * portrait photo went in.
 *
 * Everything here is the policy in lib/blog-image-spec.ts applied through
 * sharp. The policy itself is pure and lives there, shared with the browser
 * upload path, so the two cannot disagree about what 1200x628 means.
 */

/** Re-encode target for anything that is resized. Matches the existing library's format. */
const OUTPUT_MIME = 'image/webp'
const OUTPUT_QUALITY = 82

/**
 * Body images are not editorial assets and are not forced to a ratio, but the
 * article column is about 736 CSS px wide, so anything past this is pure
 * download weight on a phone.
 */
const INLINE_MAX_WIDTH = 1600

export type ImagePurpose = 'editorial' | 'inline'

export interface ConformedImage {
  bytes: Buffer
  contentType: string
  width: number
  height: number
  /** The dimensions as supplied, before anything was done to them. */
  source: { width: number; height: number; contentType: string }
  /** True when the bytes are byte-for-byte what the caller sent. */
  unchanged: boolean
  warnings: string[]
}

export async function measureImage(
  bytes: Buffer
): Promise<{ width: number; height: number; format: string }> {
  let metadata
  try {
    metadata = await sharp(bytes).metadata()
  } catch {
    throw new McpValidationError('INVALID_REQUEST', [
      'This file could not be read as an image. Check that it is a real JPEG, PNG, WebP, AVIF ' +
        'or GIF and that it is not truncated.',
    ])
  }

  // An animated source reports the height of the whole filmstrip in `height`
  // for some formats; `pageHeight` is the real frame height when it is set.
  const height = metadata.pageHeight ?? metadata.height

  if (!metadata.width || !height) {
    throw new McpValidationError('INVALID_REQUEST', [
      'This image has no readable dimensions, so it cannot be checked against the ' +
        `${BLOG_IMAGE_WIDTH}x${BLOG_IMAGE_HEIGHT} blog editorial size.`,
    ])
  }

  return { width: metadata.width, height, format: metadata.format ?? 'unknown' }
}

/**
 * Bring an upload to the blog editorial size, or explain why it cannot be.
 *
 * Four outcomes, one per verdict in the spec:
 *
 *   - exact: the original bytes are returned untouched. Re-encoding an
 *     already-correct image would cost a generation of quality for nothing.
 *   - downscale: scaled to 1200x628. The proportions were already right, so
 *     the cover fit trims under half a percent.
 *   - crop: the same transform, but only when `allowCrop` says the caller
 *     accepted it. Otherwise it is refused with the measurement in the message,
 *     because deciding what leaves the frame is an editorial call.
 *   - too_small: always refused. Upscaling turns a sharp small image into a
 *     soft large one and hides the problem instead of reporting it.
 *
 * Nothing is overwritten in any of these. Storage is content-addressed, so a
 * conformed image is written to its own path and whatever else is in the
 * bucket is untouched.
 */
export async function conformEditorialImage(
  bytes: Buffer,
  contentType: string,
  options: { allowCrop: boolean }
): Promise<ConformedImage> {
  const measured = await measureImage(bytes)
  const assessment = assessBlogImage({ width: measured.width, height: measured.height })

  const source = { width: measured.width, height: measured.height, contentType }

  if (assessment.verdict === 'too_small') {
    throw new McpValidationError('VALIDATION_FAILED', [assessment.message])
  }

  if (assessment.verdict === 'crop' && !options.allowCrop) {
    throw new McpValidationError('VALIDATION_FAILED', [
      assessment.message,
      'To take the centre crop anyway, call this tool again with fit: "cover".',
    ])
  }

  if (assessment.verdict === 'exact') {
    return {
      bytes,
      contentType,
      width: measured.width,
      height: measured.height,
      source,
      unchanged: true,
      warnings: [],
    }
  }

  const resized = await resizeToTarget(bytes, assessment)

  return {
    bytes: resized,
    contentType: OUTPUT_MIME,
    width: BLOG_IMAGE_WIDTH,
    height: BLOG_IMAGE_HEIGHT,
    source,
    unchanged: false,
    warnings: [
      assessment.message,
      ...(assessment.verdict === 'crop'
        ? ['The centre of the image was kept. Check the result before publishing.']
        : []),
      ...(contentType !== OUTPUT_MIME
        ? [`Re-encoded as WebP. The original file you supplied was not modified or stored.`]
        : []),
    ],
  }
}

/**
 * Crop first, then scale.
 *
 * `extract` + `resize` rather than sharp's own `fit: 'cover'` so the rectangle
 * that gets kept is the one lib/blog-image-spec.ts computed -- the same
 * rectangle the browser upload path uses. Letting each library pick its own
 * rounding is how two "centre crops" end up a pixel apart.
 */
async function resizeToTarget(bytes: Buffer, assessment: BlogImageAssessment): Promise<Buffer> {
  const rect = coverCropRect(assessment.source)

  return sharp(bytes)
    .extract(rect)
    .resize(BLOG_IMAGE_WIDTH, BLOG_IMAGE_HEIGHT, { fit: 'fill' })
    .webp({ quality: OUTPUT_QUALITY })
    .toBuffer()
}

/**
 * The in-body case: measured and reported, but not forced to a ratio.
 *
 * Only oversized images are touched, and only in width, so the picture's own
 * proportions survive. A body image is whatever shape its subject is.
 */
export async function conformInlineImage(
  bytes: Buffer,
  contentType: string
): Promise<ConformedImage> {
  const measured = await measureImage(bytes)
  const source = { width: measured.width, height: measured.height, contentType }

  if (measured.width <= INLINE_MAX_WIDTH) {
    return {
      bytes,
      contentType,
      width: measured.width,
      height: measured.height,
      source,
      unchanged: true,
      warnings: [],
    }
  }

  const height = Math.round((measured.height * INLINE_MAX_WIDTH) / measured.width)
  const resized = await sharp(bytes)
    .resize(INLINE_MAX_WIDTH, null, { withoutEnlargement: true })
    .webp({ quality: OUTPUT_QUALITY })
    .toBuffer()

  return {
    bytes: resized,
    contentType: OUTPUT_MIME,
    width: INLINE_MAX_WIDTH,
    height,
    source,
    unchanged: false,
    warnings: [
      `Scaled from ${measured.width}x${measured.height} to ${INLINE_MAX_WIDTH}x${height}. ` +
        'The article column is about 736 pixels wide, so anything larger is download weight. ' +
        'The proportions are unchanged.',
    ],
  }
}

export { OUTPUT_MIME, INLINE_MAX_WIDTH }
export { requiresCropConsent }
