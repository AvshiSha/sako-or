import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

import { requireStaffRequest } from '@/lib/server/staff-request'
import { saveLocation } from '@/lib/server/warehouse-locations'
import { saveLocationSchema } from '@/lib/schemas/staff-stock-schema'
import { STAFF_EDIT_ERROR_CODES } from '@/lib/staff-session'
import { shouldPromptForPinAgain } from '@/lib/staff/edit-grant'

/**
 * Saves one model/colour warehouse location.
 *
 * Authorization is checked twice, by design: the session here, and the manager
 * grant inside `saveLocation`'s transaction, where consuming it is a conditional
 * UPDATE whose row count is the check. A session alone cannot write -- a grant
 * is required from every caller, including an admin, because the iPad is shared
 * and may still hold an admin cookie from whoever used it last. The admin
 * no-PIN path is `/api/admin/warehouse-locations`.
 *
 * Stock is not touched. This writes to our database only; Verifone is read-only
 * throughout the feature.
 */

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest) {
  const auth = await requireStaffRequest(request)
  if (auth instanceof NextResponse) return auth

  const json = await request.json().catch(() => null)
  const parsed = saveLocationSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid request',
        code: STAFF_EDIT_ERROR_CODES.INVALID_REQUEST,
        issues: parsed.error.issues,
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const { modelCode, colorCode, room, route, drawer, onFloor, expectedVersion, grantId } =
    parsed.data

  // A viewer with no grant is refused before any work happens. This is the
  // write-denial path the access model rests on: the shared account can search
  // and read all day and cannot change anything.
  if (!grantId) {
    return NextResponse.json(
      {
        error: 'Manager authorization is required to edit a location',
        code: STAFF_EDIT_ERROR_CODES.FORBIDDEN,
      },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  try {
    const result = await saveLocation({
      modelCode,
      colorCode,
      room,
      route,
      drawer,
      onFloor,
      expectedVersion,
      grantId,
      actor: { uid: auth.uid, email: auth.email, role: auth.role },
    })

    switch (result.kind) {
      case 'saved':
        return NextResponse.json(
          { ok: true, location: result.location, changed: result.changed },
          { headers: { 'Cache-Control': 'no-store' } }
        )

      case 'invalid_location':
        return NextResponse.json(
          {
            error: 'Invalid warehouse location',
            code: STAFF_EDIT_ERROR_CODES.INVALID_LOCATION,
            reason: result.reason,
          },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        )

      case 'grant_invalid':
        // Expired or already spent is an ordinary thing to happen on a shared
        // device, so the client is told to ask for the PIN again rather than
        // being shown a flat refusal.
        return NextResponse.json(
          {
            error: 'Manager authorization is no longer valid',
            code: shouldPromptForPinAgain(result.reason)
              ? STAFF_EDIT_ERROR_CODES.GRANT_EXPIRED
              : STAFF_EDIT_ERROR_CODES.FORBIDDEN,
            reason: result.reason,
          },
          { status: 403, headers: { 'Cache-Control': 'no-store' } }
        )

      case 'conflict':
        // 409 with the row as it actually is, so the UI can show what someone
        // else set instead of just refusing. Nothing was overwritten.
        return NextResponse.json(
          {
            error: 'The location was changed by someone else',
            code: STAFF_EDIT_ERROR_CODES.CONFLICT,
            reason: result.reason,
            current: result.current,
          },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        )
    }
  } catch (error) {
    Sentry.captureException(error)
    console.error('[STAFF_LOCATION_SAVE] failed', { modelCode, colorCode, error })
    return NextResponse.json(
      { error: 'Could not save the location', code: STAFF_EDIT_ERROR_CODES.SAVE_FAILED },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
