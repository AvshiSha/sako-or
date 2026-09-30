import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDisplayList,
  MAX_COLLECTION_BANNERS,
  resolveBannerPlacements,
  sanitizeCollectionBanners,
  type CollectionBanner,
} from './collection-banners'

function banner(overrides: Partial<CollectionBanner> & { id: string }): CollectionBanner {
  return {
    media: { type: 'image', src: '/b.webp' },
    href: '/collection/women',
    alt: 'Women',
    afterProducts: 8,
    enabled: true,
    order: 0,
    ...overrides,
  }
}

const products = Array.from({ length: 40 }, (_, i) => `p${i}`)

test('a banner follows the configured number of products', () => {
  const [placement] = resolveBannerPlacements([banner({ id: 'a', afterProducts: 8 })], 4, 40)

  assert.equal(placement.displayIndex, 8)

  const display = buildDisplayList(products, [placement])
  assert.equal(display.slice(0, 8).every((entry) => entry.kind === 'product'), true)
  assert.equal(display[8].kind, 'banner')
})

test('the same ordinal lands on a different row per breakpoint, by design', () => {
  const config = [banner({ id: 'a', afterProducts: 8 })]

  // 4 columns -> row 2; 2 columns -> row 4. Same product, different rhythm.
  assert.equal(Math.floor(resolveBannerPlacements(config, 4, 40)[0].displayIndex / 4), 2)
  assert.equal(Math.floor(resolveBannerPlacements(config, 2, 40)[0].displayIndex / 2), 4)
})

test('the first row is allowed - the ordinal is honoured literally', () => {
  // "after 2" means the third slot, which at 4 columns is still row 0. An earlier
  // version pushed this to row 1 and silently ignored the configured number.
  const [placement] = resolveBannerPlacements([banner({ id: 'a', afterProducts: 2 })], 4, 40)

  assert.equal(placement.displayIndex, 2)
  assert.equal(Math.floor(placement.displayIndex / 4), 0, 'stays in the first row')

  const display = buildDisplayList(products, [placement])
  assert.equal(display[0].kind, 'product')
  assert.equal(display[1].kind, 'product')
  assert.equal(display[2].kind, 'banner', 'follows exactly two cards')
})

test('zero puts the banner first', () => {
  const [placement] = resolveBannerPlacements([banner({ id: 'a', afterProducts: 0 })], 4, 40)
  assert.equal(placement.displayIndex, 0)
})

test('at most one banner per row', () => {
  // Both want row 2 at 4 columns; the second falls to row 3.
  const placements = resolveBannerPlacements(
    [
      banner({ id: 'a', afterProducts: 8, order: 0 }),
      banner({ id: 'b', afterProducts: 9, order: 1 }),
    ],
    4,
    40
  )

  assert.equal(placements.length, 2)
  const rows = placements.map((placement) => Math.floor(placement.displayIndex / 4))
  assert.deepEqual(rows, [2, 3])
  assert.equal(new Set(rows).size, rows.length, 'no row holds two banners')
})

test('later banners account for the slots earlier ones consumed', () => {
  const placements = resolveBannerPlacements(
    [
      banner({ id: 'a', afterProducts: 8, order: 0 }),
      banner({ id: 'b', afterProducts: 16, order: 1 }),
    ],
    4,
    40
  )

  // The second still follows 16 real products, so its display index is shifted by
  // the one banner already spliced in.
  assert.equal(placements[1].displayIndex, 17)

  const display = buildDisplayList(products, placements)
  const before = display.slice(0, placements[1].displayIndex).filter((e) => e.kind === 'product')
  assert.equal(before.length, 16)
})

test('disabled banners are ignored', () => {
  const placements = resolveBannerPlacements(
    [banner({ id: 'a', enabled: false }), banner({ id: 'b', afterProducts: 12, order: 1 })],
    4,
    40
  )

  assert.deepEqual(placements.map((p) => p.banner.id), ['b'])
})

test('order drives precedence, not configuration order', () => {
  const placements = resolveBannerPlacements(
    [
      banner({ id: 'second', afterProducts: 8, order: 2 }),
      banner({ id: 'first', afterProducts: 8, order: 1 }),
    ],
    4,
    40
  )

  assert.deepEqual(placements.map((p) => p.banner.id), ['first', 'second'])
})

test('a banner asking for more products than are loaded waits', () => {
  // 12 products loaded; this one follows the 20th.
  const placements = resolveBannerPlacements([banner({ id: 'a', afterProducts: 20 })], 4, 12)
  assert.deepEqual(placements, [])

  // It appears once pagination has brought enough in.
  assert.equal(resolveBannerPlacements([banner({ id: 'a', afterProducts: 20 })], 4, 40).length, 1)
})

test('products keep their order and index through the splice', () => {
  const placements = resolveBannerPlacements(
    [
      banner({ id: 'a', afterProducts: 8, order: 0 }),
      banner({ id: 'b', afterProducts: 16, order: 1 }),
    ],
    4,
    40
  )
  const display = buildDisplayList(products, placements)

  const seen = display.filter((entry) => entry.kind === 'product')
  assert.equal(seen.length, products.length, 'no product dropped')
  assert.deepEqual(
    seen.map((entry) => (entry.kind === 'product' ? entry.item : null)),
    products,
    'order preserved'
  )
  seen.forEach((entry, i) => {
    if (entry.kind === 'product') assert.equal(entry.productIndex, i, 'product index unshifted')
  })
})

test('an empty grid renders no banners', () => {
  assert.deepEqual(resolveBannerPlacements([banner({ id: 'a' })], 4, 0), [])
  assert.deepEqual(buildDisplayList([], []), [])
})

test('sanitize keeps a well-formed banner', () => {
  const [clean] = sanitizeCollectionBanners([
    {
      id: 'a',
      media: { type: 'image', src: ' /b.webp ' },
      href: ' /collection/women ',
      alt: 'Women',
      afterProducts: 8.7,
      enabled: true,
      order: 1,
    },
  ])

  assert.equal(clean.media.type === 'image' && clean.media.src, '/b.webp', 'trimmed')
  assert.equal(clean.href, '/collection/women')
  assert.equal(clean.afterProducts, 8, 'floored to a whole slot')
})

test('sanitize drops entries the grid could not render', () => {
  const cleaned = sanitizeCollectionBanners([
    { id: '', media: { type: 'image', src: '/a.webp' }, href: '/x', afterProducts: 1 },
    { id: 'no-media', href: '/x', afterProducts: 1 },
    { id: 'bad-media', media: { type: 'gif', src: '/a.gif' }, href: '/x', afterProducts: 1 },
    // A video with no poster paints nothing until it downloads.
    { id: 'no-poster', media: { type: 'video', src: '/a.mp4' }, href: '/x', afterProducts: 1 },
    { id: 'no-after', media: { type: 'image', src: '/a.webp' }, href: '/x' },
    { id: 'negative', media: { type: 'image', src: '/a.webp' }, href: '/x', afterProducts: -1 },
    'not an object',
    null,
  ])

  assert.deepEqual(cleaned, [])
})

test('sanitize refuses off-site destinations', () => {
  const cleaned = sanitizeCollectionBanners([
    { id: 'a', media: { type: 'image', src: '/a.webp' }, href: 'https://elsewhere.com', afterProducts: 4 },
    { id: 'b', media: { type: 'image', src: '/a.webp' }, href: '//elsewhere.com', afterProducts: 4 },
    { id: 'c', media: { type: 'image', src: '/a.webp' }, href: '/collection/women', afterProducts: 4 },
  ])

  assert.deepEqual(cleaned.map((banner) => banner.id), ['c'])
})

test('sanitize dedupes ids and caps the count', () => {
  const duplicated = sanitizeCollectionBanners([
    { id: 'a', media: { type: 'image', src: '/a.webp' }, href: '/x', afterProducts: 4 },
    { id: 'a', media: { type: 'image', src: '/b.webp' }, href: '/y', afterProducts: 8 },
  ])
  assert.equal(duplicated.length, 1)

  const many = sanitizeCollectionBanners(
    Array.from({ length: MAX_COLLECTION_BANNERS + 4 }, (_, i) => ({
      id: `b${i}`,
      media: { type: 'image', src: '/a.webp' },
      href: '/x',
      afterProducts: i * 4,
    }))
  )
  assert.equal(many.length, MAX_COLLECTION_BANNERS)
})

test('sanitize defaults enabled to true but honours an explicit false', () => {
  const [implicit, explicit] = sanitizeCollectionBanners([
    { id: 'a', media: { type: 'image', src: '/a.webp' }, href: '/x', afterProducts: 4 },
    { id: 'b', media: { type: 'image', src: '/a.webp' }, href: '/x', afterProducts: 8, enabled: false },
  ])

  assert.equal(implicit.enabled, true)
  assert.equal(explicit.enabled, false)
})

test('sanitize tolerates a non-array', () => {
  assert.deepEqual(sanitizeCollectionBanners(undefined), [])
  assert.deepEqual(sanitizeCollectionBanners({ id: 'a' }), [])
})

test('a single column still works', () => {
  const [placement] = resolveBannerPlacements([banner({ id: 'a', afterProducts: 3 })], 1, 40)
  assert.ok(placement.displayIndex >= 1, 'not in the first row')
})
