/**
 * The warehouse layout: which rooms exist, which routes each room has, and how
 * many drawers.
 *
 * Rooms (1-5) and drawers (1-50) are fixed. Routes are capped at three per room
 * but the set that actually exists varies by room, and that real configuration
 * is not known here -- so it is read from `STAFF_WAREHOUSE_ROUTES` rather than
 * invented, and the default is permissive (all three routes in all five rooms)
 * so that nothing is wrongly ruled out before the real layout arrives.
 *
 * Pure: the env var is read by the caller and passed in as a string, which is
 * what lets `npm test` exercise the parsing.
 *
 * "route" is "maslul" in the UI, per the brief.
 */

export const MIN_ROOM = 1
export const MAX_ROOM = 5
export const MIN_ROUTE = 1
export const MAX_ROUTE = 3
export const MIN_DRAWER = 1
export const MAX_DRAWER = 50

/** Every room, in display order. */
export const ROOMS: readonly number[] = Object.freeze(
  Array.from({ length: MAX_ROOM - MIN_ROOM + 1 }, (_, i) => MIN_ROOM + i)
)

/** Every drawer, in display order. */
export const DRAWERS: readonly number[] = Object.freeze(
  Array.from({ length: MAX_DRAWER - MIN_DRAWER + 1 }, (_, i) => MIN_DRAWER + i)
)

/** The hard ceiling from the brief. A room may have fewer, never more. */
export const MAX_ROUTES_PER_ROOM = MAX_ROUTE

/** Routes available in each room, keyed by room number. */
export type RoomRoutes = Readonly<Record<number, readonly number[]>>

export type WarehouseConfig = {
  roomRoutes: RoomRoutes
  /**
   * Why the default was used, when it was. Non-null means the configured value
   * was unusable: the caller logs it and the admin screen shows it. A silent
   * fallback would offer pickers routes that do not physically exist, which is
   * worse than an obvious error.
   */
  configError: string | null
}

function everyRoute(): readonly number[] {
  return Object.freeze(
    Array.from({ length: MAX_ROUTE - MIN_ROUTE + 1 }, (_, i) => MIN_ROUTE + i)
  )
}

/** All three routes in all five rooms. Used when nothing is configured. */
export function defaultRoomRoutes(): RoomRoutes {
  const out: Record<number, readonly number[]> = {}
  for (const room of ROOMS) out[room] = everyRoute()
  return Object.freeze(out)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parses `STAFF_WAREHOUSE_ROUTES`, e.g. `{"1":[1,2,3],"2":[1,2],"3":[1]}`.
 *
 * An unset value is the normal case and yields the permissive default with no
 * error. A value that is present but unusable yields the same default WITH an
 * error, so the misconfiguration surfaces instead of masquerading as intent.
 *
 * Rooms absent from a valid configuration keep all three routes: a partial
 * configuration should restrict only what it mentions.
 */
export function parseRoomRoutes(raw: string | null | undefined): WarehouseConfig {
  if (raw === null || raw === undefined || !String(raw).trim()) {
    return { roomRoutes: defaultRoomRoutes(), configError: null }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(String(raw))
  } catch {
    return {
      roomRoutes: defaultRoomRoutes(),
      configError: 'STAFF_WAREHOUSE_ROUTES is not valid JSON',
    }
  }

  if (!isPlainObject(parsed)) {
    return {
      roomRoutes: defaultRoomRoutes(),
      configError: 'STAFF_WAREHOUSE_ROUTES must be an object keyed by room number',
    }
  }

  const out: Record<number, readonly number[]> = { ...defaultRoomRoutes() }

  for (const [roomKey, value] of Object.entries(parsed)) {
    const room = Number(roomKey)
    if (!Number.isInteger(room) || room < MIN_ROOM || room > MAX_ROOM) {
      return {
        roomRoutes: defaultRoomRoutes(),
        configError: `STAFF_WAREHOUSE_ROUTES has room "${roomKey}", outside ${MIN_ROOM}-${MAX_ROOM}`,
      }
    }

    if (!Array.isArray(value)) {
      return {
        roomRoutes: defaultRoomRoutes(),
        configError: `STAFF_WAREHOUSE_ROUTES room ${room} must map to an array of routes`,
      }
    }

    if (value.length === 0) {
      return {
        roomRoutes: defaultRoomRoutes(),
        configError: `STAFF_WAREHOUSE_ROUTES room ${room} has no routes`,
      }
    }

    if (value.length > MAX_ROUTES_PER_ROOM) {
      return {
        roomRoutes: defaultRoomRoutes(),
        configError: `STAFF_WAREHOUSE_ROUTES room ${room} lists ${value.length} routes, the maximum is ${MAX_ROUTES_PER_ROOM}`,
      }
    }

    const routes: number[] = []
    for (const entry of value) {
      const route = Number(entry)
      if (!Number.isInteger(route) || route < MIN_ROUTE || route > MAX_ROUTE) {
        return {
          roomRoutes: defaultRoomRoutes(),
          configError: `STAFF_WAREHOUSE_ROUTES room ${room} has route "${String(entry)}", outside ${MIN_ROUTE}-${MAX_ROUTE}`,
        }
      }
      if (routes.includes(route)) {
        return {
          roomRoutes: defaultRoomRoutes(),
          configError: `STAFF_WAREHOUSE_ROUTES room ${room} lists route ${route} twice`,
        }
      }
      routes.push(route)
    }

    routes.sort((a, b) => a - b)
    out[room] = Object.freeze(routes)
  }

  return { roomRoutes: Object.freeze(out), configError: null }
}

/**
 * Whether the stock sits on the floor directly beneath its drawer.
 *
 * A modifier, not an alternative: the drawer number is always required, and
 * this says "the floor under drawer 41" rather than "no drawer". That is why it
 * is a boolean rather than a placement enum -- an enum would imply the two are
 * mutually exclusive, and they are not.
 */
export type WarehouseLocationInput = {
  room: number
  route: number
  drawer: number
  /** True when the stock is on the floor beneath the drawer. */
  onFloor: boolean
}

export type LocationValidationError =
  | 'ROOM_OUT_OF_RANGE'
  | 'ROUTE_OUT_OF_RANGE'
  | 'ROUTE_NOT_IN_ROOM'
  | 'DRAWER_OUT_OF_RANGE'
  | 'ON_FLOOR_INVALID'

/**
 * The single validator for a location, used by every write path -- the staff
 * PIN-gated save and the admin save both call it, so the two can never drift.
 *
 * Returns null when valid.
 */
export function validateLocation(
  config: WarehouseConfig,
  location: WarehouseLocationInput
): LocationValidationError | null {
  const { room, route, drawer, onFloor } = location

  if (typeof onFloor !== 'boolean') return 'ON_FLOOR_INVALID'

  if (!Number.isInteger(room) || room < MIN_ROOM || room > MAX_ROOM) {
    return 'ROOM_OUT_OF_RANGE'
  }
  if (!Number.isInteger(route) || route < MIN_ROUTE || route > MAX_ROUTE) {
    return 'ROUTE_OUT_OF_RANGE'
  }
  // Required whether or not the stock is on the floor: the floor is identified
  // BY its drawer.
  if (!Number.isInteger(drawer) || drawer < MIN_DRAWER || drawer > MAX_DRAWER) {
    return 'DRAWER_OUT_OF_RANGE'
  }

  const allowed = config.roomRoutes[room]
  if (!allowed || !allowed.includes(route)) return 'ROUTE_NOT_IN_ROOM'

  return null
}

/** Convenience predicate for the UI, which only needs the boolean. */
export function isValidLocation(
  config: WarehouseConfig,
  location: WarehouseLocationInput
): boolean {
  return validateLocation(config, location) === null
}

/** Routes offered for a room. Empty for a room outside the configured range. */
export function routesForRoom(config: WarehouseConfig, room: number): readonly number[] {
  return config.roomRoutes[room] ?? []
}
