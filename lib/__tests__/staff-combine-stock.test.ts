import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  combineStock,
  compareSizes,
  isTrustedSize,
  locationOnlyCards,
  resolveColorName,
  type LocationAssignment,
} from '../staff/combine-stock'
import { staffText } from '../staff/messages'
import { PARSED_ITEMS_4925_0301 } from '../staff/__fixtures__/get-stock-by-model'

const MODEL = '4925-0301'

function location(
  colorCode: string,
  room: number,
  route: number,
  drawer: number
): LocationAssignment {
  return {
    colorCode,
    room,
    route,
    drawer,
    onFloor: false,
    version: 1,
    updatedAt: '2026-10-19T09:00:00.000Z',
    updatedBy: 'manager@sako-or.com',
  }
}

describe('resolveColorName', () => {
  it('uses the Hebrew name when there is one', () => {
    const resolved = resolveColorName('01')
    assert.equal(resolved.colorSlug, 'black')
    assert.equal(resolved.colorName, 'שחור')
    assert.equal(resolved.colorNameSource, 'hebrew')
  })

  it('falls back to the slug for a mapped colour with no Hebrew translation', () => {
    // Eight slugs in COLOR_CODE_MAP have no colorTranslations entry. 05 is
    // `zebra`. Showing the slug is honest; inventing Hebrew product copy here
    // would not be.
    const resolved = resolveColorName('05')
    assert.equal(resolved.colorSlug, 'zebra')
    assert.equal(resolved.colorName, 'zebra')
    assert.equal(resolved.colorNameSource, 'slug')
  })

  it('falls back to a code label for a colour code we do not map at all', () => {
    const resolved = resolveColorName('77')
    assert.equal(resolved.colorSlug, null)
    assert.equal(resolved.colorName, 'גוון 77')
    assert.equal(resolved.colorNameSource, 'code')
  })
})

describe('isTrustedSize', () => {
  it('trusts two digits and the one-size marker', () => {
    assert.equal(isTrustedSize('35'), true)
    assert.equal(isTrustedSize('OS'), true)
    assert.equal(isTrustedSize('os'), true)
  })

  it('distrusts a one-character size, which a 12-char ProductCode produces', () => {
    assert.equal(isTrustedSize('3'), false)
    assert.equal(isTrustedSize(''), false)
    assert.equal(isTrustedSize('X'), false)
  })
})

describe('compareSizes', () => {
  it('orders numeric sizes ascending, not lexically', () => {
    const sorted = ['41', '36', '9', '38'].sort(compareSizes)
    assert.deepEqual(sorted, ['9', '36', '38', '41'])
  })

  it('puts the one-size marker last', () => {
    const sorted = ['OS', '36', '35'].sort(compareSizes)
    assert.deepEqual(sorted, ['35', '36', 'OS'])
  })

  it('puts non-numeric sizes after numeric ones', () => {
    const sorted = ['M', '36', 'S'].sort(compareSizes)
    assert.deepEqual(sorted, ['36', 'M', 'S'])
  })
})

describe('combineStock', () => {
  it('returns every colour and size Verifone sent, with the right quantities', () => {
    const result = combineStock({ modelCode: MODEL, items: PARSED_ITEMS_4925_0301, assignments: [] })

    assert.deepEqual(
      result.colors.map((c) => c.colorCode),
      ['01', '10', '77']
    )
    assert.deepEqual(
      result.colors[0].sizes.map((s) => [s.label, s.quantity]),
      [
        ['35', 3],
        ['36', 0],
        ['37', 12],
      ]
    )
    assert.equal(result.colors[0].totalQuantity, 15)
    assert.equal(result.totalQuantity, 22)
  })

  it('keeps a genuine zero rather than hiding the size', () => {
    const result = combineStock({ modelCode: MODEL, items: PARSED_ITEMS_4925_0301, assignments: [] })
    const black = result.colors.find((c) => c.colorCode === '01')!
    const size36 = black.sizes.find((s) => s.size === '36')
    assert.ok(size36, 'size 36 must still be listed')
    assert.equal(size36!.quantity, 0)
  })

  it('keeps a colour whose code is not in COLOR_CODE_MAP', () => {
    const result = combineStock({ modelCode: MODEL, items: PARSED_ITEMS_4925_0301, assignments: [] })
    const unmapped = result.colors.find((c) => c.colorCode === '77')
    assert.ok(unmapped, 'an unmapped colour must still get a card')
    assert.equal(unmapped!.colorName, 'גוון 77')
    assert.equal(unmapped!.sizes[0].quantity, 5)
  })

  it('gives different colours of one model different locations', () => {
    const result = combineStock({
      modelCode: MODEL,
      items: PARSED_ITEMS_4925_0301,
      assignments: [location('01', 2, 1, 18), location('10', 4, 3, 7)],
    })

    const black = result.colors.find((c) => c.colorCode === '01')!
    const blue = result.colors.find((c) => c.colorCode === '10')!

    assert.deepEqual(
      { room: black.location!.room, route: black.location!.route, drawer: black.location!.drawer },
      { room: 2, route: 1, drawer: 18 }
    )
    assert.deepEqual(
      { room: blue.location!.room, route: blue.location!.route, drawer: blue.location!.drawer },
      { room: 4, route: 3, drawer: 7 }
    )
  })

  it('applies one location to every size of a colour', () => {
    const result = combineStock({
      modelCode: MODEL,
      items: PARSED_ITEMS_4925_0301,
      assignments: [location('01', 2, 1, 18)],
    })

    const black = result.colors.find((c) => c.colorCode === '01')!
    assert.equal(black.sizes.length, 3)
    // The location hangs off the colour, not the size: there is exactly one,
    // and it covers all three sizes.
    assert.equal(black.location!.drawer, 18)
  })

  it('leaves an unassigned colour as null, which is a valid state', () => {
    const result = combineStock({
      modelCode: MODEL,
      items: PARSED_ITEMS_4925_0301,
      assignments: [location('01', 2, 1, 18)],
    })

    const blue = result.colors.find((c) => c.colorCode === '10')!
    assert.equal(blue.location, null)
    // ...and the stock is still there, which is the whole requirement.
    assert.equal(blue.totalQuantity, 2)
  })

  it('ignores an assignment for a colour Verifone did not return', () => {
    const result = combineStock({
      modelCode: MODEL,
      items: PARSED_ITEMS_4925_0301,
      assignments: [location('99', 1, 1, 1)],
    })
    assert.equal(result.colors.some((c) => c.colorCode === '99'), false)
  })

  describe('images', () => {
    it('attaches only the matching colour image', () => {
      const result = combineStock({
        modelCode: MODEL,
        items: PARSED_ITEMS_4925_0301,
        assignments: [],
        catalog: {
          productName: 'נעלי סירה',
          imagesByColorSlug: {
            black: { url: 'https://cdn.example.com/black.jpg', alt: 'שחור' },
          },
        },
      })

      const black = result.colors.find((c) => c.colorCode === '01')!
      const blue = result.colors.find((c) => c.colorCode === '10')!

      assert.equal(black.image?.url, 'https://cdn.example.com/black.jpg')
      // dark-blue has no image of its own, and must NOT borrow black's.
      assert.equal(blue.image, null)
    })

    it('leaves the image null when the product is absent from the storefront', () => {
      const result = combineStock({
        modelCode: MODEL,
        items: PARSED_ITEMS_4925_0301,
        assignments: [],
        catalog: null,
      })
      for (const color of result.colors) assert.equal(color.image, null)
    })

    it('cannot attach an image to an unmapped colour code', () => {
      const result = combineStock({
        modelCode: MODEL,
        items: PARSED_ITEMS_4925_0301,
        assignments: [],
        catalog: {
          productName: null,
          imagesByColorSlug: { black: { url: 'x', alt: 'y' } },
        },
      })
      assert.equal(result.colors.find((c) => c.colorCode === '77')!.image, null)
    })
  })

  it('labels an untrustworthy size instead of showing a plausible wrong one', () => {
    const result = combineStock({
      modelCode: MODEL,
      items: [
        { productCode: '4925-0301013', sku: MODEL, colorCode: '01', size: '3', quantity: 2 },
      ],
      assignments: [],
    })
    const row = result.colors[0].sizes[0]
    assert.equal(row.trusted, false)
    assert.equal(row.label, staffText.sizeUnknown)
    // The quantity is still reported: it is the size we cannot trust, not the count.
    assert.equal(row.quantity, 2)
  })

  it('never lets one model contribute stock to another model heading', () => {
    const result = combineStock({
      modelCode: MODEL,
      items: [
        ...PARSED_ITEMS_4925_0301,
        { productCode: '1111-22220135', sku: '1111-2222', colorCode: '01', size: '35', quantity: 99 },
      ],
      assignments: [],
    })

    assert.equal(result.foreignRowsDropped, 1)
    assert.equal(result.totalQuantity, 22)
    assert.equal(result.colors.find((c) => c.colorCode === '01')!.totalQuantity, 15)
  })

  it('keeps the first of two rows for the same colour and size', () => {
    // Summing would state a quantity Verifone never gave.
    const result = combineStock({
      modelCode: MODEL,
      items: [
        { productCode: '4925-03010135', sku: MODEL, colorCode: '01', size: '35', quantity: 3 },
        { productCode: '4925-03010135', sku: MODEL, colorCode: '01', size: '35', quantity: 8 },
      ],
      assignments: [],
    })

    assert.equal(result.duplicateRowsDropped, 1)
    assert.equal(result.colors[0].sizes.length, 1)
    assert.equal(result.colors[0].sizes[0].quantity, 3)
  })

  it('returns no colours for an empty response', () => {
    const result = combineStock({ modelCode: MODEL, items: [], assignments: [] })
    assert.deepEqual(result.colors, [])
    assert.equal(result.totalQuantity, 0)
  })

  it('labels a one-size item in Hebrew', () => {
    const result = combineStock({
      modelCode: MODEL,
      items: [
        { productCode: '4925-030101OS', sku: MODEL, colorCode: '01', size: 'OS', quantity: 7 },
      ],
      assignments: [],
    })
    assert.equal(result.colors[0].sizes[0].label, staffText.oneSize)
  })
})

describe('locationOnlyCards', () => {
  it('shows stored locations with no quantities when Verifone is unreachable', () => {
    const cards = locationOnlyCards([location('10', 4, 3, 7), location('01', 2, 1, 18)])

    // Sorted by colour code, same as the stock path.
    assert.deepEqual(cards.map((c) => c.colorCode), ['01', '10'])

    for (const card of cards) {
      assert.equal(card.stockKnown, false)
      assert.deepEqual(card.sizes, [])
      // The location -- the half that IS known -- is still there.
      assert.ok(card.location)
    }
    assert.equal(cards[0].location!.drawer, 18)
    assert.equal(cards[1].location!.drawer, 7)
  })

  it('marks the stock path as known, so a real zero is distinguishable', () => {
    const result = combineStock({
      modelCode: MODEL,
      items: PARSED_ITEMS_4925_0301,
      assignments: [],
    })
    for (const card of result.colors) assert.equal(card.stockKnown, true)
  })

  it('returns nothing when no colour of the model has been assigned', () => {
    assert.deepEqual(locationOnlyCards([]), [])
  })
})

describe('out of stock is only ever a CONFIRMED zero', () => {
  const soldOutItems = [
    { productCode: '4925-03010135', sku: MODEL, colorCode: '01', size: '35', quantity: 0 },
    { productCode: '4925-03010136', sku: MODEL, colorCode: '01', size: '36', quantity: 0 },
  ]

  it('marks an individual size whose quantity is zero', () => {
    const result = combineStock({
      modelCode: MODEL,
      items: PARSED_ITEMS_4925_0301,
      assignments: [],
    })

    const black = result.colors.find((c) => c.colorCode === '01')!
    assert.deepEqual(
      black.sizes.map((s) => [s.size, s.soldOut]),
      [
        ['35', false],
        ['36', true],
        ['37', false],
      ]
    )
  })

  it('marks the whole colour only when every size is zero', () => {
    const result = combineStock({
      modelCode: MODEL,
      items: soldOutItems,
      assignments: [],
    })

    assert.equal(result.colors[0].soldOut, true)
    assert.equal(result.colors[0].totalQuantity, 0)
  })

  it('does not mark the colour when one size still has stock', () => {
    const result = combineStock({
      modelCode: MODEL,
      items: PARSED_ITEMS_4925_0301,
      assignments: [],
    })

    // Black has a zero at size 36 but stock at 35 and 37.
    const black = result.colors.find((c) => c.colorCode === '01')!
    assert.equal(black.soldOut, false)
    assert.ok(black.sizes.some((s) => s.soldOut))
  })

  it('marks a colour whose single size is zero', () => {
    const result = combineStock({
      modelCode: MODEL,
      items: [
        { productCode: '4925-030101OS', sku: MODEL, colorCode: '01', size: 'OS', quantity: 0 },
      ],
      assignments: [],
    })
    assert.equal(result.colors[0].soldOut, true)
  })

  it('still marks a size whose LABEL is untrustworthy', () => {
    // The quantity and the size come from different parts of the ProductCode:
    // not knowing which size it is does not make the count unknown.
    const result = combineStock({
      modelCode: MODEL,
      items: [
        { productCode: '4925-0301013', sku: MODEL, colorCode: '01', size: '3', quantity: 0 },
      ],
      assignments: [],
    })
    assert.equal(result.colors[0].sizes[0].trusted, false)
    assert.equal(result.colors[0].sizes[0].soldOut, true)
  })

  describe('what must NEVER be reported as out of stock', () => {
    it('a card built from a stored location when Verifone was unreachable', () => {
      // The single most damaging false positive available here: an ERP outage
      // telling a picker the shelf is empty.
      const cards = locationOnlyCards([location('01', 2, 1, 18)])
      assert.equal(cards[0].stockKnown, false)
      assert.equal(cards[0].soldOut, false)
      assert.deepEqual(cards[0].sizes, [])
    })

    it('an empty response - no colours at all', () => {
      const result = combineStock({ modelCode: MODEL, items: [], assignments: [] })
      // Nothing to mark, and nothing claimed.
      assert.deepEqual(result.colors, [])
    })

    it('a colour whose rows were all dropped as belonging to another model', () => {
      const result = combineStock({
        modelCode: MODEL,
        items: [
          { productCode: '1111-22220135', sku: '1111-2222', colorCode: '01', size: '35', quantity: 0 },
        ],
        assignments: [],
      })
      // The row is not ours, so no card and no claim about it.
      assert.equal(result.foreignRowsDropped, 1)
      assert.deepEqual(result.colors, [])
    })
  })
})
