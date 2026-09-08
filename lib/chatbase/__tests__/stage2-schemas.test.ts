import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateCheckAvailabilityRequest } from '../check-availability-schema'
import { validateFindSimilarRequest } from '../find-similar-schema'
import { validateSearchRequest } from '../search-shoes-schema'

function invalid(validate: (body: unknown) => { ok: boolean }, body: unknown) {
  const result = validate(body) as { ok: false; fields: Record<string, string> }
  assert.equal(result.ok, false, `expected ${JSON.stringify(body)} to be rejected`)
  return result.fields
}

function valid<T>(validate: (body: unknown) => { ok: boolean }, body: unknown): T {
  const result = validate(body) as unknown as { ok: true; request: T }
  assert.equal((result as { ok: boolean }).ok, true, `expected ${JSON.stringify(body)} to be accepted`)
  return result.request
}

describe('check_product_availability validation', () => {
  it('requires at least one identifier', () => {
    const fields = invalid(validateCheckAvailabilityRequest, { color: 'black', size: 39 })
    assert.match(fields.sku, /productId, sku or productUrl/)
  })

  it('accepts any one identifier on its own', () => {
    valid(validateCheckAvailabilityRequest, { sku: '4625-7809' })
    valid(validateCheckAvailabilityRequest, { productId: '4625-7809:black' })
    valid(validateCheckAvailabilityRequest, { productUrl: '/he/product/4625-7809/black' })
  })

  it('resolves a Hebrew colour to its slug', () => {
    const request = valid<{ color?: string }>(validateCheckAvailabilityRequest, {
      sku: '4625-7809',
      color: 'לבן',
    })
    assert.equal(request.color, 'white')
  })

  it('rejects an unknown colour rather than searching for nothing', () => {
    const fields = invalid(validateCheckAvailabilityRequest, { sku: '4625-7809', color: 'puce' })
    assert.match(fields.color, /puce/)
  })

  it('normalises the size', () => {
    const request = valid<{ size?: string }>(validateCheckAvailabilityRequest, {
      sku: '4625-7809',
      size: '39.0',
    })
    assert.equal(request.size, '39')
  })

  it('accepts a numeric size', () => {
    assert.equal(
      valid<{ size?: string }>(validateCheckAvailabilityRequest, { sku: 'x', size: 39 }).size,
      '39'
    )
  })

  it('defaults to Hebrew', () => {
    assert.equal(
      valid<{ locale: string }>(validateCheckAvailabilityRequest, { sku: 'x' }).locale,
      'he'
    )
  })

  it('strips Chatbase placeholders instead of failing on them', () => {
    const request = valid<{ color?: string; size?: string }>(validateCheckAvailabilityRequest, {
      sku: '4625-7809',
      color: '{{color}}',
      size: '',
    })
    assert.equal(request.color, undefined)
    assert.equal(request.size, undefined)
  })

  it('rejects an unknown key rather than ignoring it', () => {
    invalid(validateCheckAvailabilityRequest, { sku: 'x', quantity: 2 })
  })
})

describe('find_similar_shoes validation', () => {
  it('requires a source identifier', () => {
    const fields = invalid(validateFindSimilarRequest, { requestedSize: 39 })
    assert.match(fields.sourceSku, /sourceProductId, sourceSku or sourceProductUrl/)
  })

  it('defaults reason to general similarity and limit to 5', () => {
    const request = valid<{ reason: string; limit: number }>(validateFindSimilarRequest, {
      sourceSku: 'x',
    })
    assert.equal(request.reason, 'general_similarity')
    assert.equal(request.limit, 5)
  })

  it('rejects an unknown reason', () => {
    invalid(validateFindSimilarRequest, { sourceSku: 'x', reason: 'too_expensive' })
  })

  it('accepts every documented reason', () => {
    for (const reason of [
      'size_unavailable',
      'color_unavailable',
      'width_mismatch',
      'arch_mismatch',
      'lower_heel',
      'more_stable_heel',
      'lower_price',
      'general_similarity',
    ]) {
      valid(validateFindSimilarRequest, { sourceSku: 'x', reason })
    }
  })

  it('expands the footWidth shortcut', () => {
    const request = valid<{ specs: Record<string, string[]> }>(validateFindSimilarRequest, {
      sourceSku: 'x',
      footWidth: 'wide',
    })
    assert.deepEqual(request.specs.footWidthFits, [
      'most_widths',
      'regular_wide',
      'wide',
      'adjustable',
    ])
  })

  it('rejects an unknown heel type', () => {
    const fields = invalid(validateFindSimilarRequest, { sourceSku: 'x', heelTypes: ['banana'] })
    assert.match(fields.heelTypes, /banana/)
  })

  it('rejects an unknown requested colour', () => {
    invalid(validateFindSimilarRequest, { sourceSku: 'x', requestedColors: ['puce'] })
  })

  it('accepts requestedColors as a plain string from a single text box', () => {
    // The Chatbase action UI has one text box per input, so this arrives as a
    // string, not an array.
    const single = valid<{ requestedColors: string[] }>(validateFindSimilarRequest, {
      sourceSku: 'x',
      requestedColors: 'black',
    })
    assert.deepEqual(single.requestedColors, ['black'])

    const several = valid<{ requestedColors: string[] }>(validateFindSimilarRequest, {
      sourceSku: 'x',
      requestedColors: 'black,beige',
    })
    assert.deepEqual(several.requestedColors, ['black', 'beige'])
  })

  it('accepts heelTypes and categories as plain strings too', () => {
    const request = valid<{ specs: Record<string, string[]>; categories: string[] }>(
      validateFindSimilarRequest,
      { sourceSku: 'x', heelTypes: 'flat,block_heel', categories: 'sandals' }
    )
    assert.deepEqual(request.specs.heelTypes, ['flat', 'block_heel'])
    assert.deepEqual(request.categories, ['sandals'])
  })

  it('treats an unsubstituted placeholder as not provided', () => {
    const request = valid<{ requestedColors: string[]; requestedSize?: string }>(
      validateFindSimilarRequest,
      { sourceSku: 'x', requestedColors: '{{requestedColors}}', requestedSize: '' }
    )
    assert.deepEqual(request.requestedColors, [])
    assert.equal(request.requestedSize, undefined)
  })

  it('rejects an inverted price range', () => {
    invalid(validateFindSimilarRequest, { sourceSku: 'x', minPrice: 900, maxPrice: 100 })
  })

  it('caps the limit at 10', () => {
    invalid(validateFindSimilarRequest, { sourceSku: 'x', limit: 50 })
  })
})

describe('footWidth / archHeight shortcuts on search', () => {
  it('expands wide to the values that accommodate a wide foot', () => {
    const request = valid<{ specs: Record<string, string[]>; fitRequested: boolean }>(
      validateSearchRequest,
      { footWidth: 'wide' }
    )
    assert.deepEqual(request.specs.footWidthFits, [
      'most_widths',
      'regular_wide',
      'wide',
      'adjustable',
    ])
    assert.equal(request.fitRequested, true)
  })

  it('expands narrow differently, and never to the wide-only value', () => {
    const request = valid<{ specs: Record<string, string[]> }>(validateSearchRequest, {
      footWidth: 'narrow',
    })
    assert.ok(request.specs.footWidthFits.includes('narrow'))
    assert.equal(request.specs.footWidthFits.includes('wide'), false)
  })

  it('always includes the values that suit any foot', () => {
    for (const width of ['wide', 'narrow', 'regular']) {
      const request = valid<{ specs: Record<string, string[]> }>(validateSearchRequest, {
        footWidth: width,
      })
      assert.ok(
        request.specs.footWidthFits.includes('most_widths'),
        `${width} should include most_widths`
      )
      assert.ok(
        request.specs.footWidthFits.includes('adjustable'),
        `${width} should include adjustable`
      )
    }
  })

  it('expands archHeight and always allows the any-arch value', () => {
    const request = valid<{ specs: Record<string, string[]> }>(validateSearchRequest, {
      archHeight: 'high',
    })
    assert.deepEqual(request.specs.archFits, ['high', 'most_arch_types'])
  })

  it('rejects an unrecognised shortcut and names the accepted words', () => {
    const fields = invalid(validateSearchRequest, { footWidth: 'very-wide' })
    assert.match(fields.footWidth, /wide/)
    invalid(validateSearchRequest, { archHeight: 'flat' })
  })

  it('lets an explicit list override the shortcut', () => {
    const request = valid<{ specs: Record<string, string[]> }>(validateSearchRequest, {
      footWidth: 'wide',
      footWidthFits: ['narrow'],
    })
    assert.deepEqual(request.specs.footWidthFits, ['narrow'])
  })
})
