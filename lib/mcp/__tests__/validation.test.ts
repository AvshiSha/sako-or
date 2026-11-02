import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BLOG_WRITABLE_FIELDS,
  CATEGORY_WRITABLE_FIELDS,
} from '@/lib/mcp/field-allowlist'
import {
  McpValidationError,
  parseFieldPayload,
  rejectUnknownFields,
  sanitizeLocalizedField,
  validateCanonicalUrl,
  validateContentMediaUrl,
  validateReadyToPublish,
  validateSlug,
} from '@/lib/mcp/validation'

const SITE = 'https://www.sako-or.com'
const MEDIA = (path: string) =>
  `https://firebasestorage.googleapis.com/v0/b/sako-or.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media&token=abc`

/** Assert the call throws an McpValidationError with the given code. */
function rejects(fn: () => unknown, code: string, note?: string): McpValidationError {
  try {
    fn()
  } catch (error) {
    assert.ok(error instanceof McpValidationError, `expected McpValidationError, got ${error}`)
    assert.equal(error.code, code, note ?? `expected ${code}, got ${error.code}`)
    return error
  }
  assert.fail(note ?? `expected a rejection with ${code}, but the call succeeded`)
}

// ── Unknown and forbidden fields ───────────────────────────────────────────

test('an unknown field fails the whole call rather than being dropped', () => {
  const error = rejects(
    () => rejectUnknownFields({ title: {}, nonsense: 1 }, BLOG_WRITABLE_FIELDS, 'test'),
    'FORBIDDEN_FIELD'
  )
  assert.match(error.errors[0], /"nonsense"/)
  // The message lists the permitted fields, so an LLM client can correct itself.
  assert.match(error.errors[0], /Writable fields are/)
})

test('status cannot be set through an update', () => {
  rejects(
    () => parseFieldPayload({ status: 'published' }, BLOG_WRITABLE_FIELDS, 'update', SITE),
    'FORBIDDEN_FIELD',
    'setting status would be a publish button by the back door'
  )
})

test('publishedAt, sourceRef and the audit fields are all refused', () => {
  for (const field of [
    'publishedAt',
    'sourceRef',
    'createdBy',
    'updatedBy',
    'lastEditedVia',
    'createdAt',
    'updatedAt',
    'id',
    'relatedProductsCarousel',
  ]) {
    rejects(
      () => parseFieldPayload({ [field]: 'x' }, BLOG_WRITABLE_FIELDS, 'update', SITE),
      'FORBIDDEN_FIELD',
      `${field} must be refused`
    )
  }
})

test('category structure and commerce fields are all refused', () => {
  for (const field of [
    'isEnabled',
    'slug',
    'parentId',
    'level',
    'sortOrder',
    'path',
    'name',
    'productIds',
    'banners',
    'orderedVariantKeys',
  ]) {
    rejects(
      () => parseFieldPayload({ [field]: 'x' }, CATEGORY_WRITABLE_FIELDS, 'category', SITE),
      'FORBIDDEN_FIELD',
      `${field} must be refused on a category`
    )
  }
})

test('a forbidden field is reported as forbidden even when its value is also malformed', () => {
  // Order matters: "you may not set this" is the useful answer, not a shape
  // complaint that implies it would be accepted if formatted differently.
  const error = rejects(
    () => parseFieldPayload({ isEnabled: { nope: 1 } }, CATEGORY_WRITABLE_FIELDS, 'c', SITE),
    'FORBIDDEN_FIELD'
  )
  assert.match(error.errors[0], /cannot be set/)
})

// ── Slugs ──────────────────────────────────────────────────────────────────

test('a valid slug passes through trimmed', () => {
  assert.equal(validateSlug('  winter-boots-guide  '), 'winter-boots-guide')
  assert.equal(validateSlug('shoes2026'), 'shoes2026')
})

test('a Hebrew slug is refused with an explanation', () => {
  // The admin form's slugify strips non-\w, so a Hebrew title silently yields
  // "". This is the check that stops that reaching the database.
  const error = rejects(() => validateSlug('מגפי-חורף'), 'INVALID_REQUEST')
  assert.match(error.errors[0], /non-latin|Hebrew/i)
})

test('an empty or whitespace slug is refused', () => {
  rejects(() => validateSlug(''), 'INVALID_REQUEST')
  rejects(() => validateSlug('   '), 'INVALID_REQUEST')
  rejects(() => validateSlug(undefined), 'INVALID_REQUEST')
})

test('malformed slugs are refused', () => {
  for (const bad of [
    'Winter-Boots',
    'winter_boots',
    'winter--boots',
    '-winter',
    'winter-',
    'winter boots',
    'winter/boots',
    '../../etc/passwd',
    'a'.repeat(81),
  ]) {
    rejects(() => validateSlug(bad), 'INVALID_REQUEST', `"${bad}" must be refused`)
  }
})

// ── Media URLs ─────────────────────────────────────────────────────────────

test('a content-media URL is accepted', () => {
  const url = MEDIA('content/news/abc123.webp')
  assert.equal(validateContentMediaUrl(url, 'featuredImage'), url)
})

test('an image outside the content-media prefix is refused', () => {
  for (const path of [
    'products/SKU1/black/photo.jpg',
    'blog/1234-abcdef.jpg',
    'categories/1234-abcdef.jpg',
    'images/logo.png',
    'content/other/x.jpg',
  ]) {
    rejects(
      () => validateContentMediaUrl(MEDIA(path), 'featuredImage'),
      'INVALID_REQUEST',
      `${path} must be refused — it is media this integration does not own`
    )
  }
})

test('an external image host is refused', () => {
  for (const url of [
    'https://evil.test/x.jpg',
    'https://cdn.example.com/content/news/x.jpg',
    'https://firebasestorage.googleapis.com.evil.test/v0/b/x/o/content%2Fnews%2Fx.jpg',
  ]) {
    rejects(() => validateContentMediaUrl(url, 'ogImage'), 'INVALID_REQUEST')
  }
})

test('a non-https or non-URL media value is refused', () => {
  rejects(() => validateContentMediaUrl('http://firebasestorage.googleapis.com/v0/b/x/o/y', 'image'), 'INVALID_REQUEST')
  rejects(() => validateContentMediaUrl('javascript:alert(1)', 'image'), 'INVALID_REQUEST')
  rejects(() => validateContentMediaUrl('not a url', 'image'), 'INVALID_REQUEST')
  rejects(() => validateContentMediaUrl('', 'image'), 'INVALID_REQUEST')
  rejects(() => validateContentMediaUrl(null, 'image'), 'INVALID_REQUEST')
})

test('a prefix-lookalike path cannot escape the media folder', () => {
  // "content/newsletter/..." starts with "content/news" as a raw string but is
  // a different folder; the trailing slash in the prefix is what stops it.
  rejects(
    () => validateContentMediaUrl(MEDIA('content/newsletter/x.jpg'), 'image'),
    'INVALID_REQUEST'
  )
})

// ── Canonical URLs ─────────────────────────────────────────────────────────

test('a canonical URL may point at our own site or a path', () => {
  assert.equal(validateCanonicalUrl('/he/news/other', SITE), '/he/news/other')
  assert.equal(
    validateCanonicalUrl('https://www.sako-or.com/he/news/other', SITE),
    'https://www.sako-or.com/he/news/other'
  )
  assert.equal(validateCanonicalUrl('', SITE), '')
  assert.equal(validateCanonicalUrl(null, SITE), '')
})

test('an off-site canonical URL is refused', () => {
  // The admin form accepts free text here, so a typo can de-index an article by
  // canonicalising it to somebody else's page. The MCP path does not inherit that.
  rejects(() => validateCanonicalUrl('https://competitor.test/x', SITE), 'INVALID_REQUEST')
  rejects(() => validateCanonicalUrl('//competitor.test/x', SITE), 'INVALID_REQUEST')
})

// ── Sanitization ───────────────────────────────────────────────────────────

test('script tags are removed from an article body', () => {
  const result = sanitizeLocalizedField('content', {
    he: '<p>שלום</p><script>alert(1)</script>',
    en: '<p>Hello</p><script>fetch("//evil.test")</script>',
  })
  assert.ok(!result.he.includes('<script'))
  assert.ok(!result.en.includes('<script'))
  assert.ok(result.he.includes('שלום'), 'Hebrew text must survive sanitization')
  assert.ok(result.warnings.length > 0, 'a stripped tag must be reported, not silent')
})

test('event handler attributes are removed', () => {
  const result = sanitizeLocalizedField('content', {
    en: '<img src="x" onerror="alert(1)"><p onclick="steal()">hi</p>',
  })
  assert.ok(!result.en.toLowerCase().includes('onerror'))
  assert.ok(!result.en.toLowerCase().includes('onclick'))
})

test('a javascript: link is neutralized', () => {
  const result = sanitizeLocalizedField('content', {
    en: '<p><a href="javascript:alert(1)">click</a></p>',
  })
  assert.ok(!result.en.toLowerCase().includes('javascript:'))
})

test('a non-YouTube iframe is removed', () => {
  const result = sanitizeLocalizedField('content', {
    en: '<iframe src="https://evil.test/frame"></iframe>',
  })
  assert.ok(!result.en.includes('evil.test'))
})

test('a YouTube embed survives', () => {
  const result = sanitizeLocalizedField('content', {
    en: '<iframe src="https://www.youtube.com/embed/abc123"></iframe>',
  })
  assert.ok(result.en.includes('youtube.com/embed/abc123'))
})

test('markup in an excerpt is flattened to text, not escaped into the meta tag', () => {
  const result = sanitizeLocalizedField('excerpt', {
    he: '<p>תקציר <strong>מודגש</strong></p>',
  })
  assert.ok(!result.he.includes('<'), 'an excerpt renders into a meta attribute')
  assert.ok(result.he.includes('תקציר'))
})

test('a title keeps inline emphasis but loses block structure', () => {
  const result = sanitizeLocalizedField('title', { en: '<p>Winter <strong>Boots</strong></p>' })
  assert.ok(result.en.includes('<strong>'))
  assert.ok(!result.en.startsWith('<p>'), 'the title is rendered inside an h1')
})

test('seoContent is sanitized as rich HTML, like an article body', () => {
  const result = sanitizeLocalizedField('seoContent', {
    he: '<h2>כותרת</h2><script>x</script><ul><li>פריט</li></ul>',
  })
  assert.ok(result.he.includes('<h2>'))
  assert.ok(result.he.includes('<li>'))
  assert.ok(!result.he.includes('<script'))
})

test('ordinary content produces no spurious warnings', () => {
  // The sanitizer rewrites attributes (adding rel, loading), so a naive
  // length comparison would warn on every single link.
  const result = sanitizeLocalizedField('content', {
    he: '<p>טקסט עם <a href="https://example.com">קישור</a></p>',
    en: '<p>Text with a <a href="https://example.com">link</a> and <strong>emphasis</strong>.</p>',
  })
  assert.deepEqual(result.warnings, [])
})

// ── parseFieldPayload end to end ───────────────────────────────────────────

test('a valid partial payload is sanitized and returned', () => {
  const { fields, warnings } = parseFieldPayload(
    {
      title: { he: 'מגפי חורף', en: 'Winter Boots' },
      seoDescription: { he: 'תיאור', en: 'Description' },
      featuredImage: MEDIA('content/news/abc.webp'),
    },
    BLOG_WRITABLE_FIELDS,
    'update',
    SITE
  )

  assert.deepEqual(Object.keys(fields).sort(), ['featuredImage', 'seoDescription', 'title'])
  assert.equal((fields.title as { he: string }).he, 'מגפי חורף')
  assert.deepEqual(warnings, [])
})

test('a localized field given a bare string is rejected with a shape message', () => {
  const error = rejects(
    () => parseFieldPayload({ title: 'Winter Boots' }, BLOG_WRITABLE_FIELDS, 'u', SITE),
    'VALIDATION_FAILED'
  )
  assert.match(error.errors[0], /"he"/)
})

test('a localized field with neither language is rejected', () => {
  rejects(() => parseFieldPayload({ title: {} }, BLOG_WRITABLE_FIELDS, 'u', SITE), 'VALIDATION_FAILED')
})

test('an extra key inside a localized field is rejected', () => {
  rejects(
    () => parseFieldPayload({ title: { he: 'x', fr: 'y' } }, BLOG_WRITABLE_FIELDS, 'u', SITE),
    'VALIDATION_FAILED'
  )
})

test('an over-length SEO field warns but does not block', () => {
  const { warnings } = parseFieldPayload(
    { seoDescription: { en: 'x'.repeat(400) } },
    BLOG_WRITABLE_FIELDS,
    'u',
    SITE
  )
  assert.ok(warnings.some((w) => /truncates/.test(w)))
})

test('every allowlisted field has a validator', () => {
  // Guards against the allowlist and the switch in parseFieldPayload drifting
  // apart: a field added to one and not the other would be silently dropped.
  for (const field of BLOG_WRITABLE_FIELDS) {
    const probe: Record<string, unknown> = {
      [field]: ['slug'].includes(field)
        ? 'valid-slug'
        : ['featuredImage', 'ogImage'].includes(field)
          ? MEDIA('content/news/a.webp')
          : field === 'canonicalUrl'
            ? ''
            : { he: 'x', en: 'y' },
    }
    const { fields } = parseFieldPayload(probe, BLOG_WRITABLE_FIELDS, 'probe', SITE)
    assert.ok(field in fields, `${field} produced no output — missing validator`)
  }
})

// ── Readiness to publish ───────────────────────────────────────────────────

const COMPLETE = {
  slug: 'winter-boots',
  title: { he: 'מגפי חורף', en: 'Winter Boots' },
  excerpt: { he: 'תקציר', en: 'Excerpt' },
  content: { he: '<p>גוף</p>', en: '<p>Body</p>' },
  featuredImage: MEDIA('content/news/a.webp'),
  featuredImageAlt: { he: 'מגף', en: 'A boot' },
  seoTitle: { he: 'כותרת', en: 'Title' },
  seoDescription: { he: 'תיאור', en: 'Description' },
}

test('a complete article reports nothing missing', () => {
  assert.deepEqual(validateReadyToPublish(COMPLETE), [])
})

test('each missing requirement is reported by name', () => {
  for (const field of [
    'slug',
    'title',
    'excerpt',
    'content',
    'featuredImage',
    'seoTitle',
    'seoDescription',
  ] as const) {
    const incomplete = { ...COMPLETE, [field]: undefined }
    const missing = validateReadyToPublish(incomplete)
    assert.ok(missing.length > 0, `a missing ${field} must block scheduling`)
    assert.ok(
      missing.some((m) => m.toLowerCase().includes(field.toLowerCase())),
      `the message must name ${field}; got ${JSON.stringify(missing)}`
    )
  }
})

test('a featured image without alt text in both languages blocks scheduling', () => {
  const missing = validateReadyToPublish({
    ...COMPLETE,
    featuredImageAlt: { he: 'מגף', en: '' },
  })
  assert.ok(missing.some((m) => /featuredImageAlt/.test(m)))
})
