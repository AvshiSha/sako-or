/**
 * The one definition of a blog editorial image.
 *
 * "Editorial" here means the assets that represent an article rather than
 * illustrate it: the featured image, which is the hero on the article page and
 * the picture on every listing card, and the Open Graph image, which is what a
 * link preview shows. Images placed *inside* the body are not editorial assets
 * -- a close-up of a heel has no business being letterboxed to a social-card
 * ratio -- and are governed separately.
 *
 * 1200x628 is the size the content team works to. It is deliberately not
 * Facebook's nominal 1200x630: the existing library is 1650x863 and every
 * current MCP upload is 1200x628, both of which are 1.911, and matching the
 * library is worth more than matching a round number two pixels away. Nothing
 * downstream wants 630 either -- `lib/seo.ts` declares whatever this file says.
 *
 * Pure and dependency-free on purpose. Both upload paths consult it: the
 * browser one in lib/resize-image-file.ts and the server one in
 * lib/mcp/image-transform.ts. A policy that lived in only one of them is how
 * the two drifted apart in the first place.
 */

export const BLOG_IMAGE_WIDTH = 1200
export const BLOG_IMAGE_HEIGHT = 628
export const BLOG_IMAGE_RATIO = BLOG_IMAGE_WIDTH / BLOG_IMAGE_HEIGHT

/**
 * How far a source may be from 1.911 and still count as "the right shape".
 *
 * 0.5% is wide enough to take the 1650x863 library (1.9119) and a 1200x630
 * social-standard export (1.9048) without calling either a crop, and narrow
 * enough that a 16:9 source (1.7778, 7% out) is still flagged as one. Within
 * the tolerance the cover fit trims under four pixels, which is not a content
 * decision; outside it, something real leaves the frame and somebody should
 * say so first.
 */
export const BLOG_IMAGE_RATIO_TOLERANCE = 0.005

export interface ImageSize {
  width: number
  height: number
}

export type BlogImageVerdict =
  /** Already exactly 1200x628. Store the original bytes untouched. */
  | 'exact'
  /** Big enough and the right shape. Scale down; the trim is within tolerance. */
  | 'downscale'
  /** Big enough but a different shape. Scaling it means cutting real content. */
  | 'crop'
  /** Too small in at least one axis. Reaching 1200x628 would mean upscaling. */
  | 'too_small'

export interface BlogImageAssessment {
  verdict: BlogImageVerdict
  source: ImageSize
  target: ImageSize
  ratio: number
  /** True when producing the target would enlarge the image in either axis. */
  wouldUpscale: boolean
  /** What a person should do about it. Empty for 'exact'. */
  message: string
}

function describe(size: ImageSize): string {
  return `${size.width}x${size.height}`
}

const TARGET: ImageSize = { width: BLOG_IMAGE_WIDTH, height: BLOG_IMAGE_HEIGHT }

/**
 * Decide what has to happen to a source image, from its dimensions alone.
 *
 * Dimensions, never CSS and never how the page looks: the rendered size is a
 * function of the layout and the viewport and says nothing about the asset.
 */
export function assessBlogImage(source: ImageSize): BlogImageAssessment {
  const { width, height } = source
  const ratio = height > 0 ? width / height : 0

  const base = {
    source,
    target: TARGET,
    ratio,
    wouldUpscale: width < BLOG_IMAGE_WIDTH || height < BLOG_IMAGE_HEIGHT,
  }

  if (width === BLOG_IMAGE_WIDTH && height === BLOG_IMAGE_HEIGHT) {
    return { ...base, verdict: 'exact', message: '' }
  }

  if (base.wouldUpscale) {
    return {
      ...base,
      verdict: 'too_small',
      message:
        `This image is ${describe(source)}. A blog editorial image must be at least ` +
        `${describe(TARGET)}, and enlarging a smaller one would publish a visibly soft ` +
        'picture rather than fix it. Supply a larger original — ideally exactly ' +
        `${describe(TARGET)}.`,
    }
  }

  const offBy = Math.abs(ratio - BLOG_IMAGE_RATIO) / BLOG_IMAGE_RATIO
  if (offBy <= BLOG_IMAGE_RATIO_TOLERANCE) {
    return {
      ...base,
      verdict: 'downscale',
      message:
        `This image is ${describe(source)} and will be scaled down to ${describe(TARGET)}. ` +
        'Its proportions are already correct, so nothing meaningful is cut.',
    }
  }

  return {
    ...base,
    verdict: 'crop',
    message:
      `This image is ${describe(source)} (ratio ${ratio.toFixed(3)}), but a blog editorial ` +
      `image is ${describe(TARGET)} (ratio ${BLOG_IMAGE_RATIO.toFixed(3)}). Fitting it means ` +
      `cutting ${croppedPercentDescription(source)} off the ` +
      `${ratio > BLOG_IMAGE_RATIO ? 'sides' : 'top and bottom'}, which is a decision about ` +
      'what the picture is of. Either supply a correctly proportioned original, or ask for ' +
      'the centre crop explicitly.',
  }
}

/** How much of the source a centre cover-crop discards, for the error message. */
function croppedPercentDescription(source: ImageSize): string {
  const ratio = source.width / source.height
  const kept = ratio > BLOG_IMAGE_RATIO ? BLOG_IMAGE_RATIO / ratio : ratio / BLOG_IMAGE_RATIO
  return `about ${Math.round((1 - kept) * 100)}%`
}

/**
 * The crop rectangle a centre cover-fit takes out of the source.
 *
 * Returned in source pixels so both implementations can apply it the same way:
 * sharp's `extract` wants exactly this, and the canvas path feeds it straight
 * into drawImage's source arguments. Deriving it once here is what keeps the
 * browser and the server producing the same picture from the same file.
 */
export function coverCropRect(source: ImageSize): {
  left: number
  top: number
  width: number
  height: number
} {
  const ratio = source.width / source.height

  if (ratio > BLOG_IMAGE_RATIO) {
    // Wider than the target: full height, trim the sides.
    const width = Math.round(source.height * BLOG_IMAGE_RATIO)
    return {
      left: Math.round((source.width - width) / 2),
      top: 0,
      width: Math.min(width, source.width),
      height: source.height,
    }
  }

  // Taller than the target: full width, trim top and bottom.
  const height = Math.round(source.width / BLOG_IMAGE_RATIO)
  return {
    left: 0,
    top: Math.round((source.height - height) / 2),
    width: source.width,
    height: Math.min(height, source.height),
  }
}

/**
 * Whether an assessment may proceed without the caller saying anything more.
 *
 * `crop` is the only verdict that needs consent, and it needs it because the
 * result is a different picture, not a smaller one.
 */
export function requiresCropConsent(verdict: BlogImageVerdict): boolean {
  return verdict === 'crop'
}
