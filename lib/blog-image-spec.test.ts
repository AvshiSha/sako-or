import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BLOG_IMAGE_HEIGHT,
  BLOG_IMAGE_WIDTH,
  assessBlogImage,
  coverCropRect,
  requiresCropConsent,
} from '@/lib/blog-image-spec'

/**
 * The 1200x628 policy, as both upload paths apply it.
 *
 * Worth testing in one place precisely because it is applied in two: the admin
 * panel runs it through a canvas and the MCP connector through sharp, and the
 * thing that keeps those producing the same picture is that neither decides
 * anything for itself.
 */

const EXACT = { width: BLOG_IMAGE_WIDTH, height: BLOG_IMAGE_HEIGHT }

test('the exact size is passed through untouched', () => {
  const assessment = assessBlogImage(EXACT)
  assert.equal(assessment.verdict, 'exact')
  assert.equal(assessment.wouldUpscale, false)
  assert.equal(assessment.message, '')
})

test('the existing library sizes are a clean downscale, not a crop', () => {
  // These are what is actually in Firebase today: the admin editor's 1650x863
  // and 1800x942, plus the two odd ones. All of them are 1.911 within rounding,
  // so re-cutting them to 1200x628 takes nothing out of the frame. If this ever
  // fails, the tolerance has been tightened past what the library needs.
  for (const size of [
    { width: 1650, height: 863 },
    { width: 1800, height: 942 },
    { width: 1500, height: 785 },
    { width: 1350, height: 707 },
    { width: 1350, height: 706 },
  ]) {
    const assessment = assessBlogImage(size)
    assert.equal(
      assessment.verdict,
      'downscale',
      `${size.width}x${size.height} should scale cleanly, got ${assessment.verdict}`
    )
    assert.equal(requiresCropConsent(assessment.verdict), false)
  }
})

test('a 1200x630 social-standard export is accepted without asking', () => {
  // Two pixels of slack. Treating this as a crop would reject the single most
  // likely thing an SEO tool exports.
  assert.equal(assessBlogImage({ width: 1200, height: 630 }).verdict, 'downscale')
})

test('a 16:9 source is a crop and needs consent', () => {
  const assessment = assessBlogImage({ width: 1920, height: 1080 })
  assert.equal(assessment.verdict, 'crop')
  assert.equal(requiresCropConsent(assessment.verdict), true)
  assert.match(assessment.message, /top and bottom/)
  assert.match(assessment.message, /1920x1080/)
})

test('a square source is a crop, and the message says which way', () => {
  const assessment = assessBlogImage({ width: 1600, height: 1600 })
  assert.equal(assessment.verdict, 'crop')
  assert.match(assessment.message, /top and bottom/)
})

test('an ultra-wide source crops the sides', () => {
  const assessment = assessBlogImage({ width: 3000, height: 628 })
  assert.equal(assessment.verdict, 'crop')
  assert.match(assessment.message, /sides/)
})

test('anything smaller than the target in either axis is refused outright', () => {
  for (const size of [
    { width: 1199, height: 628 }, // one pixel short
    { width: 1200, height: 627 },
    { width: 800, height: 418 }, // right shape, too small
    { width: 628, height: 1200 }, // portrait
    { width: 600, height: 600 },
  ]) {
    const assessment = assessBlogImage(size)
    assert.equal(
      assessment.verdict,
      'too_small',
      `${size.width}x${size.height} must not be upscaled`
    )
    assert.equal(assessment.wouldUpscale, true)
    assert.match(assessment.message, /at least/)
  }
})

test('a portrait source is refused for being small, not offered a crop', () => {
  // The order matters. A 900x1600 phone photo is physically large but has only
  // 900 columns, so cropping it to 1200 wide would mean enlarging. Reporting
  // "too small" is the actionable answer; offering a crop would not help.
  const assessment = assessBlogImage({ width: 900, height: 1600 })
  assert.equal(assessment.verdict, 'too_small')
})

// ── The crop rectangle ─────────────────────────────────────────────────────

test('a wide source keeps its full height and is trimmed symmetrically', () => {
  // Wider than 1.911, not merely landscape: a 16:9 photo is *taller* than the
  // blog ratio and loses its top and bottom, which is the case below.
  const source = { width: 2400, height: 1000 }
  const rect = coverCropRect(source)
  assert.equal(rect.top, 0)
  assert.equal(rect.height, source.height)
  assert.ok(rect.width < source.width)
  // Centred: the margins either side are equal to within a rounding pixel.
  assert.ok(Math.abs(source.width - rect.width - rect.left * 2) <= 1)
})

test('a tall source keeps its full width and is trimmed symmetrically', () => {
  const source = { width: 1600, height: 1600 }
  const rect = coverCropRect(source)
  assert.equal(rect.left, 0)
  assert.equal(rect.width, source.width)
  assert.ok(rect.height < source.height)
  assert.ok(Math.abs(source.height - rect.height - rect.top * 2) <= 1)
})

test('the crop rectangle never reaches outside the source', () => {
  for (const source of [
    { width: 1920, height: 1080 },
    { width: 1600, height: 1600 },
    { width: 3000, height: 628 },
    { width: 1650, height: 863 },
    { width: 1201, height: 629 },
  ]) {
    const rect = coverCropRect(source)
    assert.ok(rect.left >= 0 && rect.top >= 0, `${source.width}x${source.height} negative origin`)
    assert.ok(
      rect.left + rect.width <= source.width,
      `${source.width}x${source.height} overruns horizontally`
    )
    assert.ok(
      rect.top + rect.height <= source.height,
      `${source.width}x${source.height} overruns vertically`
    )
  }
})

test('the kept rectangle is the target shape, so scaling it never stretches', () => {
  const target = BLOG_IMAGE_WIDTH / BLOG_IMAGE_HEIGHT
  for (const source of [
    { width: 1920, height: 1080 },
    { width: 1600, height: 1600 },
    { width: 3000, height: 628 },
    { width: 2400, height: 1256 },
  ]) {
    const rect = coverCropRect(source)
    const ratio = rect.width / rect.height
    assert.ok(
      Math.abs(ratio - target) / target < 0.005,
      `${source.width}x${source.height} -> ${rect.width}x${rect.height} is ratio ${ratio.toFixed(4)}, not ${target.toFixed(4)}`
    )
  }
})

test('the crop of an already-correct image is the whole image', () => {
  const rect = coverCropRect(EXACT)
  assert.deepEqual(rect, { left: 0, top: 0, width: BLOG_IMAGE_WIDTH, height: BLOG_IMAGE_HEIGHT })
})
