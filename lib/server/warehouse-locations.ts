import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ADMIN_ROLE, STAFF_ROLE } from '@/lib/admin'
import type { LocationAssignment } from '@/lib/staff/combine-stock'
import type { StoredLocation } from '@/lib/staff/location-types'
import {
  checkEditGrant,
  editGrantExpiry,
  type EditGrantRecord,
  type GrantRejection,
} from '@/lib/staff/edit-grant'
import { decideWrite, isNoOpWrite, type ConflictReason } from '@/lib/staff/location-write'
import {
  parseRoomRoutes,
  validateLocation,
  type LocationValidationError,
  type WarehouseConfig,
} from '@/lib/staff/warehouse-config'

/**
 * The one service that reads and writes warehouse locations.
 *
 * Both entry points use it -- the PIN-gated staff screen and the admin area --
 * so the validation rules, the concurrency rules and the audit trail cannot
 * diverge between them. The only difference is who is allowed to call, which is
 * the route's job, not this module's.
 */

export type { StoredLocation } from '@/lib/staff/location-types'

export type SaveActor = {
  uid: string | null
  email: string | null
  role: typeof ADMIN_ROLE | typeof STAFF_ROLE
}

export type SaveLocationInput = {
  modelCode: string
  colorCode: string
  room: number
  route: number
  drawer: number
  /** The version the caller was shown, or null when it was shown "unassigned". */
  expectedVersion: number | null
  actor: SaveActor
  /**
   * The manager grant to spend. Required on the staff path; null on the admin
   * path, where `requireAdminSession` is the authorization.
   */
  grantId: string | null
}

export type SaveLocationResult =
  | { kind: 'saved'; location: StoredLocation; changed: boolean }
  | { kind: 'conflict'; reason: ConflictReason; current: StoredLocation | null }
  | { kind: 'grant_invalid'; reason: GrantRejection }
  | { kind: 'invalid_location'; reason: LocationValidationError }

/**
 * The warehouse layout for this deployment.
 *
 * Read on each call rather than cached at module scope so that changing the
 * environment variable takes effect on the next request instead of the next
 * cold start. The parse is a few string operations on a tiny value.
 */
export function getWarehouseConfig(): WarehouseConfig {
  const config = parseRoomRoutes(process.env.STAFF_WAREHOUSE_ROUTES)
  if (config.configError) {
    // Loud, because the fallback is permissive: staff would otherwise be
    // offered routes that may not physically exist, with nothing to show that
    // the configuration was ignored.
    console.error('[STAFF_WAREHOUSE_CONFIG]', config.configError)
  }
  return config
}

function toStoredLocation(row: {
  modelCode: string
  colorCode: string
  room: number
  route: number
  drawer: number
  version: number
  updatedAt: Date
  updatedBy: string | null
}): StoredLocation {
  return {
    modelCode: row.modelCode,
    colorCode: row.colorCode,
    room: row.room,
    route: row.route,
    drawer: row.drawer,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  }
}

/**
 * Every stored assignment for one model, shaped for `combineStock`.
 *
 * Throws on a database failure rather than returning an empty list. That
 * distinction is the whole point: an empty list means "no colour of this model
 * has been assigned yet", and the screen says so. A failure must reach the
 * caller so it can be reported as a failure instead of being rendered as
 * "location not set".
 */
export async function listLocationsForModel(
  modelCode: string
): Promise<LocationAssignment[]> {
  const rows = await prisma.warehouseLocation.findMany({
    where: { modelCode },
    select: {
      colorCode: true,
      room: true,
      route: true,
      drawer: true,
      version: true,
      updatedAt: true,
      updatedBy: true,
    },
  })

  return rows.map((row) => ({
    colorCode: row.colorCode,
    room: row.room,
    route: row.route,
    drawer: row.drawer,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  }))
}

/** One stored assignment, or null when the pair has never been assigned. */
export async function getLocation(
  modelCode: string,
  colorCode: string
): Promise<StoredLocation | null> {
  const row = await prisma.warehouseLocation.findUnique({
    where: { modelCode_colorCode: { modelCode, colorCode } },
  })
  return row ? toStoredLocation(row) : null
}

/** Mints a manager grant. The caller has already verified the PIN. */
export async function createEditGrant(input: {
  firebaseUid: string
  modelCode: string
  colorCode: string
}): Promise<{ grantId: string; expiresAt: string }> {
  const expiresAt = editGrantExpiry()

  const grant = await prisma.staffEditGrant.create({
    data: {
      firebaseUid: input.firebaseUid,
      modelCode: input.modelCode,
      colorCode: input.colorCode,
      expiresAt,
    },
    select: { id: true, expiresAt: true },
  })

  return { grantId: grant.id, expiresAt: grant.expiresAt.toISOString() }
}

/**
 * Revokes every live grant held by a session.
 *
 * Called on cancel and on sign-out, so walking away from a half-finished edit
 * -- the normal thing to do on a shared device -- leaves no usable permission
 * behind.
 */
export async function revokeEditGrantsForUid(firebaseUid: string): Promise<number> {
  const { count } = await prisma.staffEditGrant.updateMany({
    where: { firebaseUid, consumedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return count
}

/**
 * Deletes grants that expired more than a day ago.
 *
 * Housekeeping only -- an expired grant is already useless. Called from the
 * existing inventory cron rather than given a cron of its own.
 */
export async function pruneExpiredEditGrants(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const { count } = await prisma.staffEditGrant.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  })
  return count
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

/** Internal signal used to abort the transaction with a classified outcome. */
class SaveAbort extends Error {
  constructor(readonly result: SaveLocationResult) {
    super('warehouse location save aborted')
  }
}

/**
 * Creates or updates one model/colour assignment, with its history entry, in a
 * single transaction.
 *
 * Order of operations, and why:
 *
 *  1. **Validate the location first.** An out-of-range drawer is a form error,
 *     and burning the manager grant on it would make them enter the PIN again
 *     for a mistake they can fix in place.
 *  2. **Consume the grant with a conditional `updateMany`.** The row count is
 *     the authorization check. A read-then-write would let two in-flight saves
 *     both spend the same grant.
 *  3. **Branch on `decideWrite`, never `upsert`.** Prisma's `upsert` selects by
 *     unique key alone and cannot express "only if version = N", so it would
 *     silently become last-write-wins -- precisely what must not happen.
 *  4. **Write history in the same transaction.** An assignment cannot exist
 *     without the entry explaining it.
 */
export async function saveLocation(
  input: SaveLocationInput
): Promise<SaveLocationResult> {
  const { modelCode, colorCode, room, route, drawer, expectedVersion, actor, grantId } =
    input

  const config = getWarehouseConfig()
  const locationError = validateLocation(config, { room, route, drawer })
  if (locationError) {
    return { kind: 'invalid_location', reason: locationError }
  }

  const now = new Date()
  const updatedBy = actor.email ?? actor.uid ?? actor.role

  try {
    return await prisma.$transaction(async (tx) => {
      // --- 1. spend the manager grant, if this path requires one -----------
      if (grantId) {
        if (!actor.uid) {
          throw new SaveAbort({ kind: 'grant_invalid', reason: 'WRONG_SESSION' })
        }

        const consumed = await tx.staffEditGrant.updateMany({
          where: {
            id: grantId,
            firebaseUid: actor.uid,
            modelCode,
            colorCode,
            consumedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { consumedAt: now },
        })

        if (consumed.count !== 1) {
          // The conditional update above is the security check; this read only
          // works out what to tell the user, so they know whether to re-enter
          // the PIN or call someone.
          const existing = (await tx.staffEditGrant.findUnique({
            where: { id: grantId },
          })) as EditGrantRecord | null

          const verdict = checkEditGrant(
            existing,
            { firebaseUid: actor.uid, modelCode, colorCode },
            now
          )

          throw new SaveAbort({
            kind: 'grant_invalid',
            reason: verdict.ok ? 'CONSUMED' : verdict.reason,
          })
        }
      }

      // --- 2. decide create / update / conflict ----------------------------
      const current = await tx.warehouseLocation.findUnique({
        where: { modelCode_colorCode: { modelCode, colorCode } },
      })

      const decision = decideWrite(expectedVersion, current)

      if (decision.kind === 'conflict') {
        throw new SaveAbort({
          kind: 'conflict',
          reason: decision.reason,
          current: current ? toStoredLocation(current) : null,
        })
      }

      // A save that changes nothing still spends the grant -- a manager did
      // authorize an edit -- but must not append a history entry claiming a
      // change that did not happen.
      if (current && isNoOpWrite(current, { room, route, drawer })) {
        return {
          kind: 'saved' as const,
          location: toStoredLocation(current),
          changed: false,
        }
      }

      // --- 3. write -------------------------------------------------------
      let saved: typeof current

      if (decision.kind === 'create') {
        try {
          saved = await tx.warehouseLocation.create({
            data: { modelCode, colorCode, room, route, drawer, updatedBy },
          })
        } catch (error) {
          // Someone else created the same model/colour between our read and
          // our write. A conflict, not a server error.
          if (isUniqueViolation(error)) {
            throw new SaveAbort({
              kind: 'conflict',
              reason: 'EXPECTED_ABSENT_BUT_EXISTS',
              current: null,
            })
          }
          throw error
        }
      } else {
        const result = await tx.warehouseLocation.updateMany({
          where: { modelCode, colorCode, version: decision.version },
          data: { room, route, drawer, updatedBy, version: { increment: 1 } },
        })

        if (result.count !== 1) {
          // Lost the race between the read above and this update.
          throw new SaveAbort({
            kind: 'conflict',
            reason: 'VERSION_MISMATCH',
            current: current ? toStoredLocation(current) : null,
          })
        }

        saved = await tx.warehouseLocation.findUnique({
          where: { modelCode_colorCode: { modelCode, colorCode } },
        })
      }

      if (!saved) {
        throw new Error('[WAREHOUSE_LOCATION_SAVE] row vanished mid-transaction')
      }

      // --- 4. history, in the same transaction -----------------------------
      await tx.warehouseLocationHistory.create({
        data: {
          locationId: saved.id,
          modelCode,
          colorCode,
          prevRoom: current?.room ?? null,
          prevRoute: current?.route ?? null,
          prevDrawer: current?.drawer ?? null,
          newRoom: room,
          newRoute: route,
          newDrawer: drawer,
          actorUid: actor.uid,
          actorEmail: actor.email,
          actorRole: actor.role,
          viaPin: Boolean(grantId),
        },
      })

      return { kind: 'saved' as const, location: toStoredLocation(saved), changed: true }
    })
  } catch (error) {
    if (error instanceof SaveAbort) return error.result
    throw error
  }
}

export type LocationHistoryEntry = {
  id: string
  modelCode: string
  colorCode: string
  previous: { room: number; route: number; drawer: number } | null
  next: { room: number; route: number; drawer: number }
  actorEmail: string | null
  actorRole: string
  viaPin: boolean
  changedAt: string
}

/**
 * The change log for a model, newest first.
 *
 * Exposed through the admin area so the audit trail is readable by someone who
 * needs it, rather than being a table only a database client can see.
 */
export async function listLocationHistory(params: {
  modelCode: string
  colorCode?: string | null
  limit?: number
}): Promise<LocationHistoryEntry[]> {
  const rows = await prisma.warehouseLocationHistory.findMany({
    where: {
      modelCode: params.modelCode,
      ...(params.colorCode ? { colorCode: params.colorCode } : {}),
    },
    orderBy: { changedAt: 'desc' },
    take: Math.min(Math.max(params.limit ?? 50, 1), 200),
  })

  return rows.map((row) => ({
    id: row.id,
    modelCode: row.modelCode,
    colorCode: row.colorCode,
    previous:
      row.prevRoom === null || row.prevRoute === null || row.prevDrawer === null
        ? null
        : { room: row.prevRoom, route: row.prevRoute, drawer: row.prevDrawer },
    next: { room: row.newRoom, route: row.newRoute, drawer: row.newDrawer },
    actorEmail: row.actorEmail,
    actorRole: row.actorRole,
    viaPin: row.viaPin,
    changedAt: row.changedAt.toISOString(),
  }))
}
