import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BLOG_READABLE_FIELDS,
  BLOG_WRITABLE_FIELDS,
  CATEGORY_READABLE_FIELDS,
  CATEGORY_WRITABLE_FIELDS,
  CONTENT_MEDIA_PREFIX,
  MCP_CONTENT_TYPES,
  isMcpContentType,
  readableFieldsFor,
  writableFieldsFor,
} from '@/lib/mcp/field-allowlist'

/**
 * Structural tests on the allowlists themselves.
 *
 * These are the access control, so the invariants are asserted rather than
 * assumed -- a future edit that quietly adds `status` to the writable blog
 * fields, or `isEnabled` to the category ones, fails here instead of in
 * production.
 */

test('writable blog fields are a subset of readable ones', () => {
  for (const field of BLOG_WRITABLE_FIELDS) {
    assert.ok(
      (BLOG_READABLE_FIELDS as readonly string[]).includes(field),
      `${field} is writable but not readable, so conflict detection could not round-trip it`
    )
  }
})

test('writable category fields are a subset of readable ones', () => {
  for (const field of CATEGORY_WRITABLE_FIELDS) {
    assert.ok(
      (CATEGORY_READABLE_FIELDS as readonly string[]).includes(field),
      `${field} is writable but not readable`
    )
  }
})

test('publication state is not a writable blog field', () => {
  // The decision this integration was scoped around: nothing ChatGPT calls may
  // set status or publishedAt. Only schedule_blog_post moves an article between
  // draft and scheduled, and only the cron publishes.
  for (const forbidden of ['status', 'publishedAt']) {
    assert.ok(
      !(BLOG_WRITABLE_FIELDS as readonly string[]).includes(forbidden),
      `${forbidden} must never be directly writable`
    )
  }
})

test('audit and identity fields are not writable', () => {
  for (const forbidden of [
    'id',
    'sourceRef',
    'createdBy',
    'updatedBy',
    'lastEditedVia',
    'createdAt',
    'updatedAt',
  ]) {
    assert.ok(
      !(BLOG_WRITABLE_FIELDS as readonly string[]).includes(forbidden),
      `${forbidden} must not be writable — a caller could forge the audit trail or defeat conflict detection`
    )
  }
})

test('merchandising is not reachable on a blog article', () => {
  assert.ok(
    !(BLOG_WRITABLE_FIELDS as readonly string[]).includes('relatedProductsCarousel'),
    'which products appear beside an article is merchandising, not editorial'
  )
})

test('category structure, visibility and commerce fields are not writable', () => {
  for (const forbidden of [
    'slug',
    'path',
    'parentId',
    'level',
    'isEnabled',
    'sortOrder',
    'name',
    'productIds',
    'banners',
    'merchandising',
    'orderedVariantKeys',
    'mode',
  ]) {
    assert.ok(
      !(CATEGORY_WRITABLE_FIELDS as readonly string[]).includes(forbidden),
      `${forbidden} must not be writable on a category`
    )
  }
})

test('the writable category set is exactly the six agreed fields', () => {
  assert.deepEqual([...CATEGORY_WRITABLE_FIELDS].sort(), [
    'contentTitle',
    'description',
    'image',
    'seoContent',
    'seoDescription',
    'seoTitle',
  ])
})

test('content types are a closed set of two', () => {
  assert.deepEqual([...MCP_CONTENT_TYPES], ['blog_article', 'category'])
})

test('no other collection can be named as a content type', () => {
  for (const attempt of [
    'products',
    'product',
    'orders',
    'users',
    'coupons',
    'campaigns',
    'colorVariants',
    'categoryMerchandising',
    'faqs',
    'staticPages',
    'settings',
    'mcpOauthAccessTokens',
    'BLOG_ARTICLE',
    '',
    null,
    undefined,
    42,
    {},
  ]) {
    assert.equal(
      isMcpContentType(attempt),
      false,
      `${JSON.stringify(attempt)} must not be accepted as a content type`
    )
  }
})

test('field resolution never returns an empty allowlist', () => {
  for (const type of MCP_CONTENT_TYPES) {
    assert.ok(readableFieldsFor(type).length > 0)
    assert.ok(writableFieldsFor(type).length > 0)
  }
})

test('the allowlists are frozen so they cannot be widened at runtime', () => {
  for (const list of [
    BLOG_READABLE_FIELDS,
    BLOG_WRITABLE_FIELDS,
    CATEGORY_READABLE_FIELDS,
    CATEGORY_WRITABLE_FIELDS,
  ]) {
    assert.ok(Object.isFrozen(list))
  }
})

test('the media prefix is a dedicated folder, not a shared one', () => {
  assert.equal(CONTENT_MEDIA_PREFIX, 'content/news/')
  // Not `blog/` or `categories/`: those hold media an admin uploaded through
  // the editor, and an MCP credential must not be able to overwrite it.
  assert.ok(!CONTENT_MEDIA_PREFIX.startsWith('blog/'))
  assert.ok(!CONTENT_MEDIA_PREFIX.startsWith('categories/'))
  assert.ok(!CONTENT_MEDIA_PREFIX.startsWith('products/'))
})
