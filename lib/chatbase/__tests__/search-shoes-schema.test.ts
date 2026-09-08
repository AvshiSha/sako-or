import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateSearchRequest, MAX_LIMIT, DEFAULT_LIMIT } from '../search-shoes-schema'

function expectInvalid(body: unknown): Record<string, string> {
  const result = validateSearchRequest(body)
  assert.equal(result.ok, false, `expected ${JSON.stringify(body)} to be rejected`)
  return (result as { ok: false; fields: Record<string, string> }).fields
}

function expectValid(body: unknown) {
  const result = validateSearchRequest(body)
  assert.equal(result.ok, true, `expected ${JSON.stringify(body)} to be accepted`)
  return (result as { ok: true; request: ReturnType<typeof validateSearchRequest> extends never ? never : any }).request
}

describe('defaults', () => {
  it('defaults to women, Hebrew, in-stock only, relevance and 5 results', () => {
    const request = expectValid({})
    assert.equal(request.gender, 'women')
    assert.equal(request.locale, 'he')
    // The whole point of the endpoint is not to recommend the unbuyable.
    assert.equal(request.inStockOnly, true)
    assert.equal(request.sortBy, 'relevance')
    assert.equal(request.limit, DEFAULT_LIMIT)
  })

  it('honours an explicit inStockOnly: false', () => {
    assert.equal(expectValid({ inStockOnly: false }).inStockOnly, false)
  })
})

describe('enum validation', () => {
  it('rejects an unknown spec value and names the allowed ones', () => {
    const fields = expectInvalid({ footWidthFits: ['very_wide'] })
    assert.match(fields.footWidthFits, /very_wide/)
    assert.match(fields.footWidthFits, /most_widths/)
  })

  it('accepts every documented value of a spec filter', () => {
    const request = expectValid({
      footWidthFits: ['most_widths', 'regular_wide', 'wide', 'adjustable'],
    })
    assert.equal(request.specs.footWidthFits.length, 4)
  })

  it("rejects the stored 'undefined' sentinel as a filter", () => {
    // Accepting it would turn "suits a wide foot" into "or nobody checked".
    expectInvalid({ footWidthFits: ['undefined'] })
    expectInvalid({ archFits: ['undefined'] })
  })

  it('rejects a bag-only closure on a footwear search', () => {
    expectInvalid({ closureTypes: ['turnlock'] })
    expectValid({ closureTypes: ['laces'] })
  })

  it('rejects an unknown sortBy', () => {
    expectInvalid({ sortBy: 'cheapest' })
  })

  it('never silently drops an unknown filter name', () => {
    // Dropping it would widen the search past what the customer asked for.
    const fields = expectInvalid({ productTypes: ['sandal'] })
    assert.ok(Object.keys(fields).length > 0)
  })
})

describe('category validation', () => {
  it('rejects non-footwear categories', () => {
    assert.match(expectInvalid({ categories: ['bags'] }).categories, /bags/)
    expectInvalid({ categories: ['belts'] })
    expectInvalid({ categories: ['accessories'] })
  })

  it('scopes categories to the requested gender', () => {
    expectInvalid({ gender: 'men', categories: ['pumps'] })
    expectValid({ gender: 'men', categories: ['moccasins'] })
  })

  it('expands a category to both its regular and outlet paths', () => {
    const request = expectValid({ categories: ['pumps'] })
    assert.deepEqual(request.categoryPaths.sort(), [
      'women/outlet/outlet-pumps',
      'women/shoes/pumps',
    ])
  })

  it('skips a disabled regular category and keeps its outlet twin', () => {
    const request = expectValid({ categories: ['ballerina-&-flats'] })
    assert.deepEqual(request.categoryPaths, ['women/outlet/outlet-ballerina-&-flats'])
  })
})

describe('colour validation', () => {
  it('resolves Hebrew and English names to the slug', () => {
    assert.deepEqual(expectValid({ colors: ['לבן'] }).colors, ['white'])
    assert.deepEqual(expectValid({ colors: ['White'] }).colors, ['white'])
    assert.deepEqual(expectValid({ colors: ['לבנות'] }).colors, ['white'])
  })

  it('de-duplicates colours that resolve alike', () => {
    assert.deepEqual(expectValid({ colors: ['white', 'לבן'] }).colors, ['white'])
  })

  it('rejects a colour the catalogue does not use', () => {
    const fields = expectInvalid({ colors: ['puce'] })
    assert.match(fields.colors, /puce/)
  })
})

describe('size handling', () => {
  it('accepts numbers and strings and normalises both', () => {
    assert.deepEqual(expectValid({ sizes: [39, '40.0', ' 41 '] }).sizes, ['39', '40', '41'])
  })

  it('de-duplicates equivalent sizes', () => {
    assert.deepEqual(expectValid({ sizes: [40, '40', '40.0'] }).sizes, ['40'])
  })
})

describe('numeric ranges', () => {
  it('rejects a negative price and a negative heel height', () => {
    assert.match(expectInvalid({ maxPrice: -1 }).maxPrice, /non-negative/)
    assert.match(expectInvalid({ maxHeelHeightCm: -1 }).maxHeelHeightCm, /non-negative/)
  })

  it('rejects a heel height beyond the stored enum', () => {
    expectInvalid({ maxHeelHeightCm: 40 })
  })

  it('rejects an inverted range', () => {
    assert.match(expectInvalid({ minPrice: 500, maxPrice: 100 }).minPrice, /maxPrice/)
    assert.match(
      expectInvalid({ minHeelHeightCm: 8, maxHeelHeightCm: 2 }).minHeelHeightCm,
      /maxHeelHeightCm/
    )
  })

  it('accepts an equal min and max', () => {
    expectValid({ minPrice: 300, maxPrice: 300 })
  })
})

describe('limit', () => {
  it('caps at the documented maximum rather than truncating silently', () => {
    assert.match(expectInvalid({ limit: MAX_LIMIT + 1 }).limit, /at most/)
    expectInvalid({ limit: 1000 })
  })

  it('rejects a non-positive or fractional limit', () => {
    expectInvalid({ limit: 0 })
    expectInvalid({ limit: 2.5 })
  })

  it('accepts the maximum', () => {
    assert.equal(expectValid({ limit: MAX_LIMIT }).limit, MAX_LIMIT)
  })
})

describe('array size guard', () => {
  it('rejects an unreasonably long value list', () => {
    expectInvalid({ sizes: Array.from({ length: 25 }, (_, i) => 30 + i) })
  })
})

describe('fitRequested', () => {
  it('is set only when a fit filter was supplied', () => {
    assert.equal(expectValid({ colors: ['black'] }).fitRequested, false)
    assert.equal(expectValid({ archFits: ['most_arch_types'] }).fitRequested, true)
  })
})

describe('Chatbase placeholder and type noise', () => {
  it('treats an unsubstituted placeholder as "not provided"', () => {
    // Chatbase substitutes textually; an uncollected variable arrives literally.
    const request = expectValid({ colors: ['{{colors}}'], sizes: ['{{sizes}}'] })
    assert.deepEqual(request.colors, [])
    assert.deepEqual(request.sizes, [])
  })

  it('treats empty strings as "not provided"', () => {
    const request = expectValid({ colors: [''], gender: '', categories: [] })
    assert.deepEqual(request.colors, [])
    assert.equal(request.gender, 'women')
  })

  it('keeps the real values when only some are placeholders', () => {
    assert.deepEqual(expectValid({ colors: ['black', '{{colors}}'] }).colors, ['black'])
  })

  it('accepts numbers delivered as strings', () => {
    const request = expectValid({ maxPrice: '300', maxHeelHeightCm: '3', limit: '5' })
    assert.equal(request.maxPrice, 300)
    assert.equal(request.maxHeelHeightCm, 3)
    assert.equal(request.limit, 5)
  })

  it('accepts booleans delivered as strings', () => {
    assert.equal(expectValid({ inStockOnly: 'false' }).inStockOnly, false)
    assert.equal(expectValid({ onSaleOnly: 'true' }).onSaleOnly, true)
  })

  it('still rejects a non-numeric string for a numeric field', () => {
    // Dropping it would silently discard a constraint the customer stated.
    expectInvalid({ maxPrice: 'cheap' })
  })

  it('splits a comma-separated list from a single Chatbase text input', () => {
    // The action UI gives one text box per input, so a multi-value filter
    // arrives as one string.
    const request = expectValid({
      footWidthFits: 'most_widths,regular_wide,wide,adjustable',
      colors: 'black, white',
      sizes: '39,40',
    })
    assert.equal(request.specs.footWidthFits.length, 4)
    assert.deepEqual(request.colors, ['black', 'white'])
    assert.deepEqual(request.sizes, ['39', '40'])
  })

  it('splits inside an array entry too', () => {
    assert.deepEqual(expectValid({ colors: ['black,white'] }).colors, ['black', 'white'])
  })

  it('still rejects an unknown value inside a comma list', () => {
    expectInvalid({ footWidthFits: 'most_widths,very_wide' })
  })

  it('never invents a filter while cleaning', () => {
    const request = expectValid({ colors: ['{{colors}}'], maxPrice: '{{maxPrice}}' })
    assert.deepEqual(request.colors, [])
    assert.equal(request.maxPrice, undefined)
  })
})

describe('multiple failures', () => {
  it('reports every invalid field at once, so the agent can fix them together', () => {
    const fields = expectInvalid({
      categories: ['bags'],
      footWidthFits: ['very_wide'],
      colors: ['puce'],
    })
    assert.ok(fields.categories)
    assert.ok(fields.footWidthFits)
    assert.ok(fields.colors)
  })
})
