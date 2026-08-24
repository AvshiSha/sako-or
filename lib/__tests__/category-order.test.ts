import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { categorySortKey, compareCategories, sortCategories } from '../category-order'

const ids = (cats: Array<{ id?: string }>) => cats.map((c) => c.id)

describe('categorySortKey', () => {
  it('returns the numeric sortOrder when present, including zero', () => {
    assert.equal(categorySortKey({ sortOrder: 0 }), 0)
    assert.equal(categorySortKey({ sortOrder: 7 }), 7)
  })

  it('sinks missing, null and non-finite sortOrder to the end', () => {
    assert.equal(categorySortKey({}), Number.POSITIVE_INFINITY)
    assert.equal(categorySortKey({ sortOrder: null }), Number.POSITIVE_INFINITY)
    assert.equal(categorySortKey({ sortOrder: NaN }), Number.POSITIVE_INFINITY)
  })
})

describe('compareCategories', () => {
  it('orders by sortOrder ascending', () => {
    assert.ok(compareCategories({ id: 'a', sortOrder: 1 }, { id: 'b', sortOrder: 2 }) < 0)
    assert.ok(compareCategories({ id: 'a', sortOrder: 5 }, { id: 'b', sortOrder: 2 }) > 0)
  })

  it('is antisymmetric', () => {
    const x = { id: 'x', sortOrder: 1, name: { en: 'Shoes' } }
    const y = { id: 'y', sortOrder: 1, name: { en: 'Outlet' } }
    assert.equal(compareCategories(x, y), -compareCategories(y, x))
  })

  it('never reports two distinct categories as equal', () => {
    // A total comparator is what stops Firestore's arbitrary document-id
    // fallback from leaking into the rendered order.
    assert.notEqual(compareCategories({ id: 'a' }, { id: 'b' }), 0)
  })
})

describe('sortCategories', () => {
  it('breaks a sortOrder tie by English name, then by id', () => {
    const sorted = sortCategories([
      { id: '3', sortOrder: 0, name: { en: 'Outlet', he: 'אאוטלט' } },
      { id: '1', sortOrder: 0, name: { en: 'Bags', he: 'תיקים' } },
      { id: '2', sortOrder: 0, name: { en: 'Bags', he: 'תיקים' } },
    ])
    assert.deepEqual(ids(sorted), ['1', '2', '3'])
  })

  it('resolves an all-ties list deterministically by id', () => {
    const sorted = sortCategories([{ id: 'c' }, { id: 'a' }, { id: 'b' }])
    assert.deepEqual(ids(sorted), ['a', 'b', 'c'])
  })

  it('sinks categories missing sortOrder below ones that have it', () => {
    const sorted = sortCategories([
      { id: 'no-order', name: { en: 'Aaa' } },
      { id: 'ordered', sortOrder: 99, name: { en: 'Zzz' } },
    ])
    assert.deepEqual(ids(sorted), ['ordered', 'no-order'])
  })

  it('treats sortOrder 0 as a real value, not as absent', () => {
    const sorted = sortCategories([
      { id: 'later', sortOrder: 1, name: { en: 'B' } },
      { id: 'zero', sortOrder: 0, name: { en: 'A' } },
    ])
    assert.deepEqual(ids(sorted), ['zero', 'later'])
  })

  it('accepts a plain string name alongside a localized one', () => {
    const sorted = sortCategories([
      { id: '2', sortOrder: 0, name: 'Bravo' },
      { id: '1', sortOrder: 0, name: { en: 'Alpha' } },
    ])
    assert.deepEqual(ids(sorted), ['1', '2'])
  })

  it('does not mutate its input', () => {
    const input = [{ id: 'b', sortOrder: 2 }, { id: 'a', sortOrder: 1 }]
    const sorted = sortCategories(input)
    assert.deepEqual(ids(input), ['b', 'a'])
    assert.deepEqual(ids(sorted), ['a', 'b'])
  })

  it('is idempotent - sorting an already sorted list changes nothing', () => {
    const input = [
      { id: 'c', name: { en: 'Gamma' } },
      { id: 'a', sortOrder: 3, name: { en: 'Alpha' } },
      { id: 'b', sortOrder: 3, name: { en: 'Beta' } },
    ]
    const once = sortCategories(input)
    assert.deepEqual(ids(sortCategories(once)), ids(once))
  })

  it('orders he and en identically, since the tiebreak ignores locale', () => {
    // The Hebrew names sort in the opposite order to the English ones; the
    // result must follow the English tiebreak in both cases so the RTL nav is
    // a mirror of the LTR nav rather than a different list.
    const cats = [
      { id: '1', sortOrder: 0, name: { en: 'Shoes', he: 'תיקים' } },
      { id: '2', sortOrder: 0, name: { en: 'Bags', he: 'נעליים' } },
    ]
    assert.deepEqual(ids(sortCategories(cats)), ['2', '1'])
  })
})
