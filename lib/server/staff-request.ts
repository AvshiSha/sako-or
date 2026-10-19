import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session'
import { verifyAdminSessionCookie } from '@/lib/server/admin-session'
import { STAFF_SESSION_COOKIE } from '@/lib/staff-session'
import { verifyStaffSessionCookie } from '@/lib/server/staff-session'
import type { StaffRole } from '@/lib/server/staff'

/**
 * Per-request authorization for the staff API.
 *
 * Returns the same `context | NextResponse` union as `lib/server/auth.ts`, so
 * call sites keep the house `instanceof NextResponse` idiom:
 *
 *     const auth = await requireStaffRequest(request)
 *     if (auth instanceof NextResponse) return auth
 *
 * ## Why this is not `requireUserAuth`
 *
 * Two reasons, both load-bearing.
 *
 * First, `requireUserAuth` 403s any account whose Firebase provider is
 * `password` and which is not an admin -- the storefront is OTP-only. The
 * shared warehouse account is exactly that: a password account that is not an
 * admin. Routing the staff API through it would reject every request.
 *
 * Second, it is bearer-token-only. The iPad has an httpOnly session cookie and
 * no client Firebase session to mint an ID token from, by design: this surface
 * performs no client-SDK Firestore writes, so it does not need one.
 *
 * ## Why the context is a new type
 *
 * `AuthedRequestContext` requires `token`, `decoded`, `firebaseUser` and
 * `authProvider`. A cookie-only session has none of them, and inventing an
 * empty `token` or a fake `authProvider` is how a later caller ends up trusting
 * a value that was never real. This type carries only what actually exists.
 */
export type StaffRequestContext = {
  uid: string
  email: string | null
  role: StaffRole
}

/** 401 when the caller has no usable session, 403 when it has no access. */
export async function requireStaffRequest(
  request: NextRequest
): Promise<StaffRequestContext | NextResponse> {
  const staffCookie = request.cookies.get(STAFF_SESSION_COOKIE)?.value
  if (staffCookie) {
    const session = await verifyStaffSessionCookie(staffCookie)
    if (session) {
      return { uid: session.uid, email: session.email, role: session.role }
    }
  }

  // An admin signed into /admin can use the staff API without a second login,
  // matching `readStaffSession`.
  const adminCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (adminCookie) {
    const adminSession = await verifyAdminSessionCookie(adminCookie)
    if (adminSession) {
      return { uid: adminSession.uid, email: adminSession.email, role: 'ADMIN' }
    }
  }

  return NextResponse.json(
    { error: 'Staff authentication required' },
    { status: 401 }
  )
}

/**
 * Note there is deliberately no "admins skip the PIN here" helper.
 *
 * `PUT /api/staff/locations` requires a manager grant from EVERY caller,
 * including an admin. The iPad is a shared device that may still be carrying an
 * admin cookie from the last person who used it, so making the PIN conditional
 * on the role would quietly remove the control exactly where it is needed most.
 *
 * The admin no-PIN path is the admin area -- `/api/admin/warehouse-locations`,
 * gated by `requireAdminSession` and calling the same service -- which is what
 * the brief asks for and which is reached from a desk, not the warehouse floor.
 */
