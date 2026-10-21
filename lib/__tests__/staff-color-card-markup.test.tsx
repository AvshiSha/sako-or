import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'

import ColorStockCard from '@/app/(staff)/staff/stock/_components/ColorStockCard'
import type { StaffColorCard } from '../staff/combine-stock'
import type { LocationsState } from '../staff/api-types'
import { staffText } from '../staff/messages'

/**
 * The colour card's markup, asserted directly.
 *
 * This closes the one coverage gap the end-to-end suite genuinely cannot reach.
 * The staff screen is behind a Firebase SESSION COOKIE verified against Google
 * with `checkRevoked`, which -- unlike a client Firebase session -- cannot be
 * forged from a Playwright init script, and adding a test-only bypass to the
 * gate to make it testable would be a bypass that eventually ships. So the
 * presentation rules are pinned here instead, and the Playwright spec covers
 * the gate, the API authorization and the RTL root layout.
 *
 * Same technique as `faq-ssr-markup.test.tsx`: render the real component with
 * `renderToStaticMarkup`. `ColorStockCard` is a client component, but its only
 * hook is a `useState` initialiser, which server rendering evaluates normally.
 *
 * Three rules are enforced here because each one, if broken, sends a picker to
 * the wrong place or tells them something untrue:
 *
 *  1. No image means no image element -- not a placeholder, not reserved space.
 *  2. A location read failure is never rendered as "no location assigned".
 *  3. No quantity is rendered when the quantity is not known.
 */

function card(overrides: Partial<StaffColorCard> = {}): StaffColorCard {
  return {
    colorCode: '01',
    colorSlug: 'black',
    colorName: 'שחור',
    colorNameSource: 'hebrew',
    location: {
      room: 2,
      route: 1,
      drawer: 18,
      onFloor: false,
      version: 1,
      updatedAt: '2026-10-19T09:00:00.000Z',
      updatedBy: 'manager@sako-or.com',
    },
    sizes: [
      { size: '35', label: '35', quantity: 3, soldOut: false, trusted: true },
      { size: '36', label: '36', quantity: 0, soldOut: true, trusted: true },
    ],
    totalQuantity: 3,
    image: null,
    soldOut: false,
    stockKnown: true,
    ...overrides,
  }
}

function render(
  overrides: Partial<StaffColorCard> = {},
  locationsState: LocationsState = 'ok'
): string {
  return renderToStaticMarkup(
    <ColorStockCard
      card={card(overrides)}
      locationsState={locationsState}
      onEditLocation={() => {}}
      editDisabled={false}
    />
  )
}

describe('the location is readable at a glance', () => {
  it('renders room, route and drawer in the format the brief specifies', () => {
    const html = render()
    // "חדר 2 · מסלול 1 · מגירה 18"
    assert.match(html, /חדר 2/)
    assert.match(html, /מסלול 1/)
    assert.match(html, /מגירה 18/)
  })

  it('uses the Hebrew term for route', () => {
    assert.match(render(), /מסלול/)
    assert.doesNotMatch(render(), /route/i)
  })

  it('says so plainly when no location has been assigned', () => {
    const html = render({ location: null })
    assert.match(html, new RegExp(staffText.noLocation))
    assert.doesNotMatch(html, /חדר \d/)
  })
})

describe('a location failure is not an unassigned location', () => {
  it('reports a read failure as its own state', () => {
    const html = render({ location: null }, 'error')
    assert.match(html, new RegExp(staffText.locationUnavailable))
    // The crucial negative: it must NOT claim the location is simply unset.
    assert.doesNotMatch(html, new RegExp(staffText.noLocation))
  })

  it('does not show a stored location while the read is failing', () => {
    // A location in hand but a failed read means what is in hand may be stale;
    // the error is what gets shown.
    const html = render({}, 'error')
    assert.match(html, new RegExp(staffText.locationUnavailable))
    assert.doesNotMatch(html, /מגירה 18/)
  })
})

describe('images are optional enrichment', () => {
  it('renders no image element at all when there is no image', () => {
    const html = render({ image: null })
    assert.doesNotMatch(html, /<img/)
    // And nothing standing in for one.
    assert.doesNotMatch(html, /placeholder/i)
    assert.doesNotMatch(html, /no image/i)
    assert.doesNotMatch(html, /אין תמונה/)
  })

  it('renders the image when the colour has one', () => {
    const html = render({
      image: { url: 'https://cdn.example.com/black.jpg', alt: 'נעלי סירה שחורות' },
    })
    assert.match(html, /<img/)
    assert.match(html, /https:\/\/cdn\.example\.com\/black\.jpg/)
    assert.match(html, /נעלי סירה שחורות/)
  })

  it('still renders stock and location for a colour with no image', () => {
    const html = render({ image: null })
    assert.match(html, /מגירה 18/)
    assert.match(html, />3</)
  })
})

describe('quantities', () => {
  it('shows a genuine zero as a row rather than hiding the size', () => {
    const html = render()
    assert.match(html, />36</)
    assert.match(html, />0</)
  })

  it('renders no size table and no total when stock is not known', () => {
    // Verifone unreachable: the location is still useful, but a quantity here
    // would be a service failure masquerading as "we have none".
    const html = render({ stockKnown: false, sizes: [], totalQuantity: 0, soldOut: false })

    assert.doesNotMatch(html, /<table/)
    assert.match(html, new RegExp(staffText.stockUnavailable))
    // The location half survives.
    assert.match(html, /מגירה 18/)
  })

  it('labels an untrustworthy size instead of a plausible wrong one', () => {
    const html = render({
      sizes: [
        { size: '3', label: staffText.sizeUnknown, quantity: 2, soldOut: false, trusted: false },
      ],
    })
    assert.match(html, new RegExp(staffText.sizeUnknown))
  })
})

describe('the colour heading', () => {
  it('shows the Hebrew colour name and the Verifone code', () => {
    const html = render()
    assert.match(html, /שחור/)
    assert.match(html, />01</)
  })

  it('falls back to a code label for a colour the catalog does not know', () => {
    const html = render({
      colorCode: '77',
      colorSlug: null,
      colorName: 'גוון 77',
      colorNameSource: 'code',
    })
    assert.match(html, /גוון 77/)
  })

  it('offers the edit action on every card, assigned or not', () => {
    assert.match(render(), new RegExp(staffText.editLocation))
    assert.match(render({ location: null }), new RegExp(staffText.editLocation))
  })
})

describe('out of stock is shown in red, and only when confirmed', () => {
  it('labels an individual zero size', () => {
    const html = render()
    assert.match(html, new RegExp(staffText.outOfStock))
    // The red comes from the design system token, not an invented colour.
    assert.match(html, /text-accent-error/)
  })

  it('labels the whole colour when every size is zero', () => {
    const html = render({
      sizes: [
        { size: '35', label: '35', quantity: 0, soldOut: true, trusted: true },
        { size: '36', label: '36', quantity: 0, soldOut: true, trusted: true },
      ],
      totalQuantity: 0,
      soldOut: true,
    })

    assert.match(html, /data-testid="staff-color-sold-out"/)
    assert.match(html, new RegExp(staffText.outOfStock))
  })

  it('does not label the colour when one size still has stock', () => {
    // The default fixture has stock at 35 and a zero at 36.
    const html = render()
    assert.doesNotMatch(html, /data-testid="staff-color-sold-out"/)
    // ...but the zero size is still flagged.
    assert.match(html, /data-testid="staff-size-sold-out"/)
  })

  it('says nothing about stock when Verifone could not be read', () => {
    const html = render({ stockKnown: false, sizes: [], totalQuantity: 0, soldOut: false })

    assert.doesNotMatch(html, new RegExp(staffText.outOfStock))
    assert.match(html, new RegExp(staffText.stockUnavailable))
    // And the location half is still there.
    assert.match(html, /מגירה 18/)
  })

  it('says nothing about stock when the location read failed either', () => {
    const html = render({ stockKnown: false, sizes: [], soldOut: false }, 'error')
    assert.doesNotMatch(html, new RegExp(staffText.outOfStock))
  })
})

describe('the floor flag', () => {
  it('appends רצפה after the drawer, keeping the drawer number', () => {
    const html = render({
      location: {
        room: 3,
        route: 1,
        drawer: 41,
        onFloor: true,
        version: 1,
        updatedAt: '2026-10-21T09:00:00.000Z',
        updatedBy: null,
      },
    })

    assert.match(html, /חדר 3/)
    assert.match(html, /מסלול 1/)
    // Both the drawer AND the floor: the floor is beneath drawer 41.
    assert.match(html, /מגירה 41/)
    assert.match(html, new RegExp(staffText.floorLabel))
  })

  it('shows nothing extra when the flag is off', () => {
    const html = render()
    assert.match(html, /מגירה 18/)
    assert.doesNotMatch(html, new RegExp(staffText.floorLabel))
  })
})
