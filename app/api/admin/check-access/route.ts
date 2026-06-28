import { NextRequest, NextResponse } from 'next/server'
import { requireUserAuth } from '@/lib/server/auth'
import { adminAuth } from '@/lib/firebase-admin'

export async function GET(request: NextRequest) {
  const auth = await requireUserAuth(request)
  if (auth instanceof NextResponse) return auth

  // Keep the Firebase custom claim in sync so Firestore security rules can
  // enforce admin-only writes (request.auth.token.admin == true).
  // setCustomUserClaims is idempotent on the Firebase side; we skip the call
  // when the claim already matches to avoid unnecessary token invalidations.
  try {
    const currentAdminClaim = auth.decoded?.admin === true
    if (auth.isAdmin && !currentAdminClaim) {
      await adminAuth.setCustomUserClaims(auth.firebaseUid, { admin: true })
    } else if (!auth.isAdmin && currentAdminClaim) {
      await adminAuth.setCustomUserClaims(auth.firebaseUid, { admin: false })
    }
  } catch (err) {
    // Non-fatal: the UI still works; the Firestore rule will just require a
    // token refresh on the next page load before write operations succeed.
    console.error('[check-access] Failed to sync admin custom claim:', err)
  }

  return NextResponse.json({ ok: true, isAdmin: auth.isAdmin })
}
