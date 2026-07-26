import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProductImages, getProductImageAlt } from '../product-images'

describe('normalizeProductImages', () => {
  it('normalizes a legacy string[] with no imageDetails, using fallback alt text', () => {
    const result = normalizeProductImages(
      ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
      undefined,
      { titleEn: "Women's Silver Leather Pumps", titleHe: 'נעלי סירה כסופות מעור לנשים' }
    )
    assert.equal(result.length, 2)
    assert.equal(result[0].url, 'https://cdn.example.com/a.jpg')
    assert.equal(result[0].order, 0)
    assert.equal(result[0].altEn, "Women's Silver Leather Pumps")
    assert.equal(result[1].order, 1)
  })

  it('merges imageDetails metadata (matched by URL) onto the legacy images list', () => {
    const result = normalizeProductImages(
      ['https://cdn.example.com/side.jpg'],
      [{ url: 'https://cdn.example.com/side.jpg', altEn: 'Shown from the side', altHe: 'במבט צד', type: 'side', order: 3 }]
    )
    assert.equal(result[0].altEn, 'Shown from the side')
    assert.equal(result[0].type, 'side')
    assert.equal(result[0].order, 3)
  })

  it('does not overwrite an explicit alt text with the fallback', () => {
    const result = normalizeProductImages(
      ['https://cdn.example.com/side.jpg'],
      [{ url: 'https://cdn.example.com/side.jpg', altEn: 'Custom alt' }],
      { titleEn: 'Fallback title' }
    )
    assert.equal(result[0].altEn, 'Custom alt')
  })

  it('sorts by order and ignores detail entries with no matching image URL', () => {
    const result = normalizeProductImages(
      ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
      [
        { url: 'https://cdn.example.com/b.jpg', order: 0 },
        { url: 'https://cdn.example.com/a.jpg', order: 1 },
        { url: 'https://cdn.example.com/missing.jpg', order: 5 },
      ]
    )
    assert.equal(result.length, 2)
    assert.equal(result[0].url, 'https://cdn.example.com/b.jpg')
    assert.equal(result[1].url, 'https://cdn.example.com/a.jpg')
  })

  it('ignores malformed image entries and returns an empty array for non-array input', () => {
    assert.deepEqual(normalizeProductImages([null, 42, ''], undefined), [])
    assert.deepEqual(normalizeProductImages(undefined, undefined), [])
    assert.deepEqual(normalizeProductImages(null, null), [])
  })
})

describe('getProductImageAlt', () => {
  it('falls back to the other locale when one is missing', () => {
    const image = { url: 'x', altEn: 'English alt', order: 0 }
    assert.equal(getProductImageAlt(image, 'he'), 'English alt')
    assert.equal(getProductImageAlt(image, 'en'), 'English alt')
  })

  it('returns an empty string when neither locale has alt text', () => {
    const image = { url: 'x', order: 0 }
    assert.equal(getProductImageAlt(image, 'en'), '')
  })
})
