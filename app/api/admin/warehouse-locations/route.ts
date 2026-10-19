import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

import { requireAdminSession } from '@/lib/server/auth'
import {
  getWarehouseConfig,
  listLocationHistory,
  listLocationsForModel,
  saveLocation,
} from '@/lib/server/warehouse-locations'
import {
  adminSaveLocationSchema,
  historyQuerySchema,
} from '@/lib/schemas/staff-stock-schema'
import { STAFF_EDIT_ERROR_CODES } from '@/lib/staff-session'
import { ADMIN_ROLE } from '@/lib/admin'

/**
 * Admin-side warehouse location management.
 *
 * The same `lib/server/warehouse-locations.ts` service the staff screen uses,
 * so validation, concurrency and the audit trail are identical. The only
 * difference is the authorization: `requireAdminSession` here, a manager PIN
 * grant there. That split is what the brief asks for -- an admin manages
 * locations from the admin area, while the shared viewer account stays confined
 * to the warehouse workflow.
 *
 * It also serves as the way out of a PIN lockout: five wrong PINs stop editing
 * on the iPad, and an admin can still make the change from here.
 *
 * `GET` reads assignments, or the change history with `?history=1`. The history
 * endpoint exists so the audit trail is readable by the people who need it,
 * rather than being a table only a database client can see.
 */

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request)
  if (auth instanceof NextResponse) return auth

  const params = request.nextUrl.searchParams
  const wantsHistory = params.get('history') === '1'

  const parsed = historyQuerySchema.safeParse({
    modelCode: params.get('modelCode') ?? '',
    colorCode: params.get('colorCode') ?? undefined,
    limit: params.get('limit') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', issues: parsed.error.issues },
      { status: 400, headers: NO_STORE }
    )
  }

  const { modelCode, colorCode, limit } = parsed.data

  try {
    if (wantsHistory) {
      const history = await listLocationHistory({ modelCode, colorCode, limit })
      return NextResponse.json({ modelCode, history }, { headers: NO_STORE })
    }

    const locations = await listLocationsForModel(modelCode)
    const warehouse = getWarehouseConfig()

    return NextResponse.json(
      {
        modelCode,
        locations,
        warehouse: {
          roomRoutes: warehouse.roomRoutes,
          configError: warehouse.configError,
        },
      },
      { headers: NO_STORE }
    )
  } catch (error) {
    Sentry.captureException(error)
    console.error('[ADMIN_WAREHOUSE_LOCATIONS_GET] failed', { modelCode, error })
    return NextResponse.json(
      { error: 'Could not read warehouse locations' },
      { status: 500, headers: NO_STORE }
    )
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminSession(request)
  if (auth instanceof NextResponse) return auth

  const json = await request.json().catch(() => null)
  const parsed = adminSaveLocationSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid request',
        code: STAFF_EDIT_ERROR_CODES.INVALID_REQUEST,
        issues: parsed.error.issues,
      },
      { status: 400, headers: NO_STORE }
    )
  }

  const { modelCode, colorCode, room, route, drawer, expectedVersion } = parsed.data

  try {
    const result = await saveLocation({
      modelCode,
      colorCode,
      room,
      route,
      drawer,
      expectedVersion,
      // No grant on this path: the admin session IS the authorization. Recorded
      // in the history with `viaPin: false`, so the two routes stay
      // distinguishable after the fact.
      grantId: null,
      actor: { uid: auth.firebaseUid, email: auth.email, role: ADMIN_ROLE },
    })

    switch (result.kind) {
      case 'saved':
        return NextResponse.json(
          { ok: true, location: result.location, changed: result.changed },
          { headers: NO_STORE }
        )

      case 'invalid_location':
        return NextResponse.json(
          {
            error: 'Invalid warehouse location',
            code: STAFF_EDIT_ERROR_CODES.INVALID_LOCATION,
            reason: result.reason,
          },
          { status: 400, headers: NO_STORE }
        )

      case 'conflict':
        return NextResponse.json(
          {
            error: 'The location was changed by someone else',
            code: STAFF_EDIT_ERROR_CODES.CONFLICT,
            reason: result.reason,
            current: result.current,
          },
          { status: 409, headers: NO_STORE }
        )

      case 'grant_invalid':
        // Unreachable on this path -- no grant is passed -- but handled rather
        // than left to fall through the switch silently.
        return NextResponse.json(
          { error: 'Authorization failed', code: STAFF_EDIT_ERROR_CODES.FORBIDDEN },
          { status: 403, headers: NO_STORE }
        )
    }
  } catch (error) {
    Sentry.captureException(error)
    console.error('[ADMIN_WAREHOUSE_LOCATIONS_PUT] failed', { modelCode, colorCode, error })
    return NextResponse.json(
      { error: 'Could not save the location', code: STAFF_EDIT_ERROR_CODES.SAVE_FAILED },
      { status: 500, headers: NO_STORE }
    )
  }
}
