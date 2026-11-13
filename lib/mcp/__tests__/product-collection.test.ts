import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BLOG_READABLE_FIELDS,
  BLOG_WRITABLE_FIELDS,
} from '@/lib/mcp/field-allowlist'
import {
  MAX_CAROUSEL_PRODUCTS,
  McpValidationError,
  parseFieldPayload,
  validateProductCollection,
} from '@/lib/mcp/validation'

/**
 * The shape half of the product-collection association.
 *
 * Whether an id names a real, enabled collection needs Firestore and is
 * exercised by scripts/verify-mcp-tools.ts against a running server. These are
 * the checks that must hold before anything touches the database, and the
 * boundary they defend: this field associates an article with a collection and
 * must not become a way to reach the collection itself.
 */

const SITE = 'https://www.sako-or.com'

function rejects(fn: () => unknown, code: string, because: string): McpValidationError {
  try {
    fn()
  } catch (error) {
    assert.ok(error instanceof McpValidationError, because)
    assert.equal(error.code, code, `${because} (got ${error.code}: ${error.errors[0]})`)
    return error
  }
  assert.fail(`expected a rejection: ${because}`)
}

// ── Shape ──────────────────────────────────────────────────────────────────

test('a collection id alone is a valid selection', () => {
  assert.deepEqual(validateProductCollection({ collectionId: 'e1szxDLxtVHLoQjc5jd9' }), {
    collectionId: 'e1szxDLxtVHLoQjc5jd9',
  })
})

test('null is the documented way to clear the selection', () => {
  assert.equal(validateProductCollection(null), null)
})

test('maxProducts is carried through when it is a sane whole number', () => {
  assert.deepEqual(validateProductCollection({ collectionId: 'abc', maxProducts: 12 }), {
    collectionId: 'abc',
    maxProducts: 12,
  })
})

test('maxProducts outside the supported range is refused', () => {
  for (const value of [0, -1, 1.5, MAX_CAROUSEL_PRODUCTS + 1, '8', null]) {
    rejects(
      () => validateProductCollection({ collectionId: 'abc', maxProducts: value }),
      'INVALID_REQUEST',
      `maxProducts ${JSON.stringify(value)} must be refused`
    )
  }
})

test('a missing or empty collectionId is refused with the accepted shapes', () => {
  for (const payload of [{}, { collectionId: '' }, { collectionId: '   ' }, { collectionId: 42 }]) {
    const error = rejects(
      () => validateProductCollection(payload),
      'INVALID_REQUEST',
      `${JSON.stringify(payload)} must be refused`
    )
    assert.match(error.errors[0], /collectionId/)
  }
})

test('a bare string or an array is refused rather than guessed at', () => {
  // One documented shape. A string that happens to look like an id would work
  // until the day somebody passes a slug, and then it would fail as NOT_FOUND
  // with no hint that the shape was the problem.
  for (const value of ['e1szxDLxtVHLoQjc5jd9', ['a', 'b'], 42, true]) {
    rejects(
      () => validateProductCollection(value),
      'INVALID_REQUEST',
      `${JSON.stringify(value)} is not a selection`
    )
  }
})

// ── The boundary ───────────────────────────────────────────────────────────

test('the ancestor chain cannot be supplied by the caller', () => {
  // categoryIds is what the storefront queries on. A caller that could set it
  // directly could point the section at an arbitrary slice of the catalogue,
  // including one no collection page corresponds to.
  const error = rejects(
    () => validateProductCollection({ collectionId: 'abc', categoryIds: ['x', 'y'] }),
    'FORBIDDEN_FIELD',
    'categoryIds is derived by the server, never supplied'
  )
  assert.match(error.errors[0], /categoryIds/)
})

test('the section cannot be switched on without a collection, or given a mode', () => {
  for (const key of ['enabled', 'mode', 'products', 'productIds', 'isEnabled']) {
    rejects(
      () => validateProductCollection({ collectionId: 'abc', [key]: 'whatever' }),
      'FORBIDDEN_FIELD',
      `${key} must not be settable inside productCollection`
    )
  }
})

test('the raw carousel field is still refused by name', () => {
  // The narrow field is the only way in. The stored object carries `enabled`
  // and `mode` as well, and this is what keeps those out of reach.
  rejects(
    () =>
      parseFieldPayload(
        { relatedProductsCarousel: { enabled: true, categoryIds: ['x'] } },
        BLOG_WRITABLE_FIELDS,
        'update',
        SITE
      ),
    'FORBIDDEN_FIELD',
    'relatedProductsCarousel must not be writable directly'
  )
})

// ── Partial updates ────────────────────────────────────────────────────────

test('omitting the field leaves no trace in the parsed payload', () => {
  // This is what preserves the existing selection: the field never reaches the
  // Firestore update, so the stored object is not rewritten.
  const { fields } = parseFieldPayload(
    { seoTitle: { he: 'כותרת', en: 'Title' } },
    BLOG_WRITABLE_FIELDS,
    'update',
    SITE
  )
  assert.ok(!('productCollection' in fields), 'an unrelated edit must not touch the association')
})

test('an explicit null survives parsing as null, not as absent', () => {
  // The distinction the whole clearing path rests on: `undefined` means leave
  // it alone and `null` means remove it, so null must not be filtered out with
  // the undefined values.
  const { fields } = parseFieldPayload(
    { productCollection: null },
    BLOG_WRITABLE_FIELDS,
    'update',
    SITE
  )
  assert.ok('productCollection' in fields)
  assert.equal(fields.productCollection, null)
})

test('the field round-trips: what can be written can be read back', () => {
  assert.ok((BLOG_WRITABLE_FIELDS as readonly string[]).includes('productCollection'))
  assert.ok((BLOG_READABLE_FIELDS as readonly string[]).includes('productCollection'))
})
