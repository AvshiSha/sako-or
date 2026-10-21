import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { formatLocation } from '../staff/messages'
import {
  DRAWERS,
  MAX_ROUTES_PER_ROOM,
  ROOMS,
  defaultRoomRoutes,
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
    assert.equal(validateLocation(permissive, { room: 2, route: 1, drawer: 18, onFloor: false }), null)
    assert.equal(isValidLocation(permissive, { room: 5, route: 3, drawer: 50, onFloor: false }), true)
    assert.equal(isValidLocation(permissive, { room: 1, route: 1, drawer: 1, onFloor: false }), true)
  })

  it('rejects a room outside 1-5', () => {
    assert.equal(
      validateLocation(permissive, { room: 0, route: 1, drawer: 1, onFloor: false }),
      'ROOM_OUT_OF_RANGE'
    )
    assert.equal(
      validateLocation(permissive, { room: 6, route: 1, drawer: 1, onFloor: false }),
      'ROOM_OUT_OF_RANGE'
    )
  })

  it('rejects a route outside 1-3', () => {
    assert.equal(
      validateLocation(permissive, { room: 1, route: 4, drawer: 1, onFloor: false }),
      'ROUTE_OUT_OF_RANGE'
    )
  })

  it('rejects a drawer outside 1-50', () => {
    assert.equal(
      validateLocation(permissive, { room: 1, route: 1, drawer: 0, onFloor: false }),
      'DRAWER_OUT_OF_RANGE'
    )
    assert.equal(
      validateLocation(permissive, { room: 1, route: 1, drawer: 51, onFloor: false }),
      'DRAWER_OUT_OF_RANGE'
    )
  })

  it('rejects a route that is in range but not present in that room', () => {
    assert.equal(validateLocation(restricted, { room: 2, route: 2, drawer: 9, onFloor: false }), null)
    assert.equal(
      validateLocation(restricted, { room: 2, route: 3, drawer: 9, onFloor: false }),
      'ROUTE_NOT_IN_ROOM'
    )
  })

  it('rejects non-integers, including values a form might submit as strings', () => {
    assert.equal(
      validateLocation(permissive, { room: 1.5, route: 1, drawer: 1, onFloor: false }),
      'ROOM_OUT_OF_RANGE'
    )
    assert.equal(
      validateLocation(permissive, { room: 1, route: 1, drawer: Number.NaN, onFloor: false }),
      'DRAWER_OUT_OF_RANGE'
    )
    assert.equal(
      validateLocation(permissive, {
        room: '2' as unknown as number,
        route: 1,
        drawer: 1,
        onFloor: false,
      }),
      'ROOM_OUT_OF_RANGE'
    )
  })
})

describe('the floor flag', () => {
  const permissive = parseRoomRoutes(undefined)

  it('accepts a location with the flag on, drawer and all', () => {
    assert.equal(
      validateLocation(permissive, { room: 3, route: 1, drawer: 41, onFloor: true }),
      null
    )
  })

  it('still requires a drawer when the flag is on', () => {
    // `רצפה` means the floor BENEATH a drawer, so the drawer identifies it.
    assert.equal(
      validateLocation(permissive, {
        room: 3,
        route: 1,
        drawer: null as unknown as number,
        onFloor: true,
      }),
      'DRAWER_OUT_OF_RANGE'
    )
  })

  it('applies the same drawer range whether the flag is on or off', () => {
    for (const onFloor of [true, false]) {
      assert.equal(
        validateLocation(permissive, { room: 1, route: 1, drawer: 51, onFloor }),
        'DRAWER_OUT_OF_RANGE'
      )
      assert.equal(
        validateLocation(permissive, { room: 1, route: 1, drawer: 50, onFloor }),
        null
      )
    }
  })

  it('rejects a non-boolean flag', () => {
    assert.equal(
      validateLocation(permissive, {
        room: 1,
        route: 1,
        drawer: 1,
        onFloor: 'yes' as unknown as boolean,
      }),
      'ON_FLOOR_INVALID'
    )
  })
})

describe('formatLocation', () => {
  it('renders room, route and drawer when the flag is off', () => {
    assert.equal(
      formatLocation({ room: 3, route: 1, drawer: 41, onFloor: false }),
      'חדר 3 · מסלול 1 · מגירה 41'
    )
  })

  it('appends the floor when the flag is on, keeping the drawer', () => {
    assert.equal(
      formatLocation({ room: 3, route: 1, drawer: 41, onFloor: true }),
      'חדר 3 · מסלול 1 · מגירה 41 · רצפה'
    )
  })

  it('adds nothing when the flag is absent, for rows saved before it existed', () => {
    assert.equal(
      formatLocation({ room: 2, route: 1, drawer: 18 }),
      'חדר 2 · מסלול 1 · מגירה 18'
    )
  })
})
