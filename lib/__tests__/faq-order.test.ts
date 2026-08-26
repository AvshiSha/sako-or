import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  compareFaqs,
  densifyFaqOrder,
  faqOrderKey,
  groupFaqsByAudience,
  nextOrderForAudience,
  orderUpdatesFromSequence,
  reorderAfterAudienceChange,
  reorderAfterRemoval,
  sortFaqs,
  validateReorderMembership,
  type OrderableFaq,
} from '../faq-order'
import type { FaqAudience, FaqItem } from '../faq-types'

const item = (
  id: string,
  audience: FaqAudience,
  order?: number | null,
  slug = id
): OrderableFaq => ({ id, audience, order, slug })

const ids = (items: readonly { id: string }[]) => items.map((i) => i.id)

describe('faqOrderKey', () => {
  it('returns the numeric order, including zero', () => {
    assert.equal(faqOrderKey({ order: 0 }), 0)
    assert.equal(faqOrderKey({ order: 5 }), 5)
  })

  it('sinks missing, null and non-finite order to the end', () => {
    // A record written before this field existed must not jump to the top.
    assert.equal(faqOrderKey({}), Number.POSITIVE_INFINITY)
    assert.equal(faqOrderKey({ order: null }), Number.POSITIVE_INFINITY)
    assert.equal(faqOrderKey({ order: NaN }), Number.POSITIVE_INFINITY)
  })
})

describe('compareFaqs', () => {
  it('orders by order ascending', () => {
    assert.ok(compareFaqs(item('a', 'women', 1), item('b', 'women', 2)) < 0)
    assert.ok(compareFaqs(item('a', 'women', 5), item('b', 'women', 2)) > 0)
  })

  it('never reports two distinct items as equal, even with no order at all', () => {
    // Two Infinity keys subtract to NaN, which sort() reads as "equal" — that
    // would let Firestore's arbitrary document order decide the page.
    assert.notEqual(compareFaqs(item('a', 'women'), item('b', 'women')), 0)
    assert.notEqual(compareFaqs(item('a', 'women', 3), item('b', 'women', 3)), 0)
  })

  it('is antisymmetric', () => {
    const x = item('x', 'women', 1)
    const y = item('y', 'women', 1)
    assert.equal(compareFaqs(x, y), -compareFaqs(y, x))
  })
})

describe('sortFaqs', () => {
  it('sorts by order and puts order-less items last', () => {
    const sorted = sortFaqs([item('c', 'women'), item('a', 'women', 1), item('b', 'women', 0)])
    assert.deepEqual(ids(sorted), ['b', 'a', 'c'])
  })

  it('does not mutate its input', () => {
    const input = [item('b', 'women', 1), item('a', 'women', 0)]
    sortFaqs(input)
    assert.deepEqual(ids(input), ['b', 'a'])
  })
})

describe('groupFaqsByAudience', () => {
  it('groups and sorts, in the public section order', () => {
    const grouped = groupFaqsByAudience([
      item('m1', 'men', 0),
      item('w2', 'women', 1),
      item('g1', 'general', 0),
      item('w1', 'women', 0),
    ])
    assert.deepEqual(Object.keys(grouped), ['women', 'men', 'general'])
    assert.deepEqual(ids(grouped.women), ['w1', 'w2'])
    assert.deepEqual(ids(grouped.men), ['m1'])
    assert.deepEqual(ids(grouped.general), ['g1'])
  })

  it('always returns every audience key, even when empty', () => {
    const grouped = groupFaqsByAudience([item('w1', 'women', 0)])
    assert.deepEqual(grouped.men, [])
    assert.deepEqual(grouped.general, [])
  })

  it('ignores an unknown audience rather than throwing', () => {
    const grouped = groupFaqsByAudience([
      item('w1', 'women', 0),
      { id: 'x', audience: 'kids' as FaqAudience, order: 0 },
    ])
    assert.deepEqual(ids(grouped.women), ['w1'])
  })
})

describe('nextOrderForAudience', () => {
  it('starts at 0 for an empty group', () => {
    assert.equal(nextOrderForAudience([], 'women'), 0)
    assert.equal(nextOrderForAudience([item('m1', 'men', 0)], 'women'), 0)
  })

  it('appends after the current maximum within the audience only', () => {
    const items = [item('w1', 'women', 0), item('w2', 'women', 1), item('m1', 'men', 7)]
    assert.equal(nextOrderForAudience(items, 'women'), 2)
    assert.equal(nextOrderForAudience(items, 'men'), 8)
  })

  it('stays dense when existing items have no order at all', () => {
    assert.equal(nextOrderForAudience([item('w1', 'women'), item('w2', 'women')], 'women'), 2)
  })
})

describe('densifyFaqOrder', () => {
  it('renumbers to 0..n-1 preserving relative order', () => {
    const updates = densifyFaqOrder(
      [item('a', 'women', 5), item('b', 'women', 10), item('c', 'women', 30)],
      'women'
    )
    assert.deepEqual(updates, [
      { id: 'a', order: 0 },
      { id: 'b', order: 1 },
      { id: 'c', order: 2 },
    ])
  })

  it('returns only the items that actually change', () => {
    const updates = densifyFaqOrder(
      [item('a', 'women', 0), item('b', 'women', 1), item('c', 'women', 9)],
      'women'
    )
    assert.deepEqual(updates, [{ id: 'c', order: 2 }])
  })

  it('ignores other audiences', () => {
    const updates = densifyFaqOrder([item('m1', 'men', 4), item('w1', 'women', 4)], 'women')
    assert.deepEqual(updates, [{ id: 'w1', order: 0 }])
  })

  it('includes hidden and draft items, so the sequence never develops gaps', () => {
    // Ordering over published items only is the bug this guards: hiding one
    // would leave a hole that decides where the next publish lands.
    const updates = densifyFaqOrder(
      [item('a', 'women', 0), item('b', 'women', 1), item('c', 'women', 2)],
      'women'
    )
    assert.deepEqual(updates, [])
  })
})

describe('orderUpdatesFromSequence', () => {
  it('maps an id sequence to dense positions', () => {
    assert.deepEqual(orderUpdatesFromSequence(['c', 'a', 'b']), [
      { id: 'c', order: 0 },
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
    ])
  })
})

describe('validateReorderMembership', () => {
  it('accepts an exact permutation of the current group', () => {
    const result = validateReorderMembership(['a', 'b', 'c'], ['c', 'a', 'b'])
    assert.equal(result.valid, true)
    assert.deepEqual(result.missing, [])
    assert.deepEqual(result.unknown, [])
    assert.deepEqual(result.duplicates, [])
  })

  it('reports ids the caller left out — someone else added a question', () => {
    const result = validateReorderMembership(['a', 'b', 'c'], ['a', 'b'])
    assert.equal(result.valid, false)
    assert.deepEqual(result.missing, ['c'])
  })

  it('reports ids that are not in the group — someone else deleted one', () => {
    const result = validateReorderMembership(['a', 'b'], ['a', 'b', 'zombie'])
    assert.equal(result.valid, false)
    assert.deepEqual(result.unknown, ['zombie'])
  })

  it('reports duplicates', () => {
    const result = validateReorderMembership(['a', 'b'], ['a', 'a', 'b'])
    assert.equal(result.valid, false)
    assert.deepEqual(result.duplicates, ['a'])
  })
})

describe('reorderAfterRemoval', () => {
  it('closes the gap left by a deleted item', () => {
    const updates = reorderAfterRemoval(
      [item('a', 'women', 0), item('b', 'women', 1), item('c', 'women', 2)],
      'women',
      'b'
    )
    assert.deepEqual(updates, [{ id: 'c', order: 1 }])
  })
})

describe('reorderAfterAudienceChange', () => {
  const items = [
    { id: 'w1', audience: 'women', order: 0, slug: 'w1' },
    { id: 'w2', audience: 'women', order: 1, slug: 'w2' },
    { id: 'w3', audience: 'women', order: 2, slug: 'w3' },
    { id: 'm1', audience: 'men', order: 0, slug: 'm1' },
  ] as unknown as FaqItem[]

  it('densifies the old group and appends to the new one', () => {
    const updates = reorderAfterAudienceChange(items, 'w2', 'women', 'men')
    // w3 closes the gap w2 left behind...
    assert.deepEqual(
      updates.filter((u) => u.id === 'w3'),
      [{ id: 'w3', order: 1 }]
    )
    // ...and w2 lands at the end of the men's group, after m1.
    assert.deepEqual(
      updates.filter((u) => u.id === 'w2'),
      [{ id: 'w2', order: 1 }]
    )
  })

  it('does nothing when the audience did not actually change', () => {
    assert.deepEqual(reorderAfterAudienceChange(items, 'w2', 'women', 'women'), [])
  })
})
