import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { formatLocation } from '../staff/messages'
import {
  DRAWERS,
  MAX_ROUTES_PER_ROOM,
  ROOMS,
  defaultRoomRoutes,
  isFloorPlacement,
  isValidLocation,
  parseRoomRoutes,
  routesForRoom,
  validateLocation,
} from '../staff/warehouse-config'

describe('warehouse ranges', () => {
  it('offers rooms 1-5 and drawers 1-50', () => {
    assert.deepEqual([...ROOMS], [1, 2, 3, 4, 5])
    assert.equal(DRAWERS.length, 50)
    assert.equal(DRAWERS[0], 1)
    assert.equal(DRAWERS[DRAWERS.length - 1], 50)
  })

  it('caps routes per room at three', () => {
    assert.equal(MAX_ROUTES_PER_ROOM, 3)
  })
})

describe('parseRoomRoutes', () => {
  it('defaults to all three routes in all five rooms when unset', () => {
    // Permissive on purpose: the real room-to-route layout is not known here,
    // and ruling out a route that exists would hide a drawer from a picker.
    for (const raw of [undefined, null, '', '   ']) {
      const config = parseRoomRoutes(raw)
      assert.equal(config.configError, null)
      assert.deepEqual(config.roomRoutes, defaultRoomRoutes())
      for (const room of ROOMS) {
        assert.deepEqual([...routesForRoom(config, room)], [1, 2, 3])
      }
    }
  })

  it('applies a full configuration', () => {
    const config = parseRoomRoutes('{"1":[1,2,3],"2":[1,2],"3":[1],"4":[2,3],"5":[1,3]}')
    assert.equal(config.configError, null)
    assert.deepEqual([...routesForRoom(config, 2)], [1, 2])
    assert.deepEqual([...routesForRoom(config, 3)], [1])
    assert.deepEqual([...routesForRoom(config, 4)], [2, 3])
  })

  it('restricts only the rooms it mentions', () => {
    const config = parseRoomRoutes('{"3":[1]}')
    assert.equal(config.configError, null)
    assert.deepEqual([...routesForRoom(config, 3)], [1])
    assert.deepEqual([...routesForRoom(config, 1)], [1, 2, 3])
  })

  it('sorts routes regardless of how they were written', () => {
    const config = parseRoomRoutes('{"1":[3,1]}')
    assert.deepEqual([...routesForRoom(config, 1)], [1, 3])
  })

  describe('a bad value falls back loudly, never silently', () => {
    // A silent fallback would offer pickers routes that do not physically
    // exist, which is worse than an obvious configuration error.
    const badValues: Array<[string, string]> = [
      ['not JSON', 'nonsense{'],
      ['an array', '[1,2,3]'],
      ['a bare string', '"1,2,3"'],
      ['a room above the range', '{"6":[1]}'],
      ['a room below the range', '{"0":[1]}'],
      ['a non-numeric room', '{"ground":[1]}'],
      ['a room mapped to a non-array', '{"1":3}'],
      ['a room with no routes', '{"1":[]}'],
      ['more than three routes', '{"1":[1,2,3,4]}'],
      ['a route above the range', '{"1":[4]}'],
      ['a route below the range', '{"1":[0]}'],
      ['a duplicated route', '{"1":[1,1]}'],
    ]

    for (const [label, raw] of badValues) {
      it(label, () => {
        const config = parseRoomRoutes(raw)
        assert.ok(config.configError, `expected an error for ${label}`)
        assert.match(config.configError!, /STAFF_WAREHOUSE_ROUTES/)
        assert.deepEqual(config.roomRoutes, defaultRoomRoutes())
      })
    }
  })
})

describe('validateLocation', () => {
  const permissive = parseRoomRoutes(undefined)
  const restricted = parseRoomRoutes('{"2":[1,2]}')

  it('accepts a location inside every range', () => {
    assert.equal(validateLocation(permissive, { room: 2, route: 1, drawer: 18, placement: 'DRAWER' }), null)
    assert.equal(isValidLocation(permissive, { room: 5, route: 3, drawer: 50, placement: 'DRAWER' }), true)
    assert.equal(isValidLocation(permissive, { room: 1, route: 1, drawer: 1, placement: 'DRAWER' }), true)
  })

  it('rejects a room outside 1-5', () => {
    assert.equal(
      validateLocation(permissive, { room: 0, route: 1, drawer: 1, placement: 'DRAWER' }),
      'ROOM_OUT_OF_RANGE'
    )
    assert.equal(
      validateLocation(permissive, { room: 6, route: 1, drawer: 1, placement: 'DRAWER' }),
      'ROOM_OUT_OF_RANGE'
    )
  })

  it('rejects a route outside 1-3', () => {
    assert.equal(
      validateLocation(permissive, { room: 1, route: 4, drawer: 1, placement: 'DRAWER' }),
      'ROUTE_OUT_OF_RANGE'
    )
  })

  it('rejects a drawer outside 1-50', () => {
    assert.equal(
      validateLocation(permissive, { room: 1, route: 1, drawer: 0, placement: 'DRAWER' }),
      'DRAWER_OUT_OF_RANGE'
    )
    assert.equal(
      validateLocation(permissive, { room: 1, route: 1, drawer: 51, placement: 'DRAWER' }),
      'DRAWER_OUT_OF_RANGE'
    )
  })

  it('rejects a route that is in range but not present in that room', () => {
    assert.equal(validateLocation(restricted, { room: 2, route: 2, drawer: 9, placement: 'DRAWER' }), null)
    assert.equal(
      validateLocation(restricted, { room: 2, route: 3, drawer: 9, placement: 'DRAWER' }),
      'ROUTE_NOT_IN_ROOM'
    )
  })

  it('rejects non-integers, including values a form might submit as strings', () => {
    assert.equal(
      validateLocation(permissive, { room: 1.5, route: 1, drawer: 1, placement: 'DRAWER' }),
      'ROOM_OUT_OF_RANGE'
    )
    assert.equal(
      validateLocation(permissive, { room: 1, route: 1, drawer: Number.NaN, placement: 'DRAWER' }),
      'DRAWER_OUT_OF_RANGE'
    )
    assert.equal(
      validateLocation(permissive, {
        room: '2' as unknown as number,
        route: 1,
        drawer: 1,
        placement: 'DRAWER',
      }),
      'ROOM_OUT_OF_RANGE'
    )
  })
})

describe('floor placement', () => {
  const permissive = parseRoomRoutes(undefined)
  const restricted = parseRoomRoutes('{"2":[1,2]}')

  it('accepts a floor location with no drawer', () => {
    assert.equal(
      validateLocation(permissive, { room: 2, route: 1, drawer: null, placement: 'FLOOR' }),
      null
    )
  })

  it('still applies the room and route rules on the floor', () => {
    assert.equal(
      validateLocation(permissive, { room: 9, route: 1, drawer: null, placement: 'FLOOR' }),
      'ROOM_OUT_OF_RANGE'
    )
    assert.equal(
      validateLocation(restricted, { room: 2, route: 3, drawer: null, placement: 'FLOOR' }),
      'ROUTE_NOT_IN_ROOM'
    )
  })

  describe('the two shapes cannot be mixed', () => {
    // One stored shape per real location. The database CHECK enforces the same
    // rule; this is the layer that gives a usable error instead of a 500.
    it('rejects a floor placement carrying a drawer number', () => {
      assert.equal(
        validateLocation(permissive, { room: 1, route: 1, drawer: 7, placement: 'FLOOR' }),
        'PLACEMENT_DRAWER_MISMATCH'
      )
    })

    it('rejects a drawer placement with no drawer number', () => {
      assert.equal(
        validateLocation(permissive, { room: 1, route: 1, drawer: null, placement: 'DRAWER' }),
        'PLACEMENT_DRAWER_MISMATCH'
      )
    })

    it('rejects an unknown placement', () => {
      assert.equal(
        validateLocation(permissive, {
          room: 1,
          route: 1,
          drawer: 1,
          placement: 'SHELF' as unknown as 'DRAWER',
        }),
        'PLACEMENT_INVALID'
      )
    })
  })

  it('leaves numbered drawers working exactly as before', () => {
    assert.equal(
      validateLocation(permissive, { room: 2, route: 1, drawer: 18, placement: 'DRAWER' }),
      null
    )
    assert.equal(
      validateLocation(permissive, { room: 2, route: 1, drawer: 51, placement: 'DRAWER' }),
      'DRAWER_OUT_OF_RANGE'
    )
  })

  it('reports the floor through isFloorPlacement', () => {
    assert.equal(isFloorPlacement({ placement: 'FLOOR' }), true)
    assert.equal(isFloorPlacement({ placement: 'DRAWER' }), false)
  })
})

describe('formatLocation', () => {
  it('renders a numbered drawer', () => {
    assert.equal(
      formatLocation({ room: 2, route: 1, drawer: 18, placement: 'DRAWER' }),
      'חדר 2 · מסלול 1 · מגירה 18'
    )
  })

  it('renders the floor as the word, with no number', () => {
    assert.equal(
      formatLocation({ room: 2, route: 1, drawer: null, placement: 'FLOOR' }),
      'חדר 2 · מסלול 1 · רצפה'
    )
  })

  it('treats a null drawer as the floor even without an explicit placement', () => {
    // Defensive: a row read back before the placement column existed.
    assert.equal(
      formatLocation({ room: 3, route: 2, drawer: null }),
      'חדר 3 · מסלול 2 · רצפה'
    )
  })
})
