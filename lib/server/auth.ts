import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { isAdminEmail, normalizeEmail } from '@/lib/admin'

export type AuthedRequestContext = {
  token: string
  decoded: any
  firebaseUid: string
  firebaseUser: any
  email: string | null
  isAdmin: boolean
  authProvider: string
}

export function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

function pickAuthProvider(firebaseUser: any, decoded: any): string {
  const providerIds: string[] =
    firebaseUser?.providerData?.map((p: any) => p?.providerId).filter(Boolean) ?? []

  // If the user has a password provider attached, treat it as password auth.
  // (This is what we want to block for non-admins.)
  if (providerIds.includes('password')) return 'password'

  // Prefer well-known providers if present.
  if (providerIds.includes('phone')) return 'phone'
  if (providerIds.includes('google.com')) return 'google.com'

  const signInProvider = (decoded as any)?.firebase?.sign_in_provider as string | undefined
  return providerIds[0] ?? signInProvider ?? 'firebase'
}

/**
 * Verifies Firebase bearer token, fetches Firebase user record, and enforces OTP-only auth:
 * - If auth provider is `password` AND requester is not an admin -> 403.
 */
export async function requireUserAuth(
  request: NextRequest
): Promise<AuthedRequestContext | NextResponse> {
  const token = getBearerToken(request)
  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 })
  }

  let decoded: any
  try {
    decoded = await adminAuth.verifyIdToken(token)
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const firebaseUid = decoded.uid
  const firebaseUser = await adminAuth.getUser(firebaseUid)

  const email = normalizeEmail(firebaseUser.email ?? decoded.email ?? null)
  const isAdmin = isAdminEmail(email)
  const authProvider = pickAuthProvider(firebaseUser, decoded)

  if (authProvider === 'password' && !isAdmin) {
    return NextResponse.json(
      { error: 'Password authentication is disabled. Please sign in using SMS/email code.' },
      { status: 403 }
    )
  }

  return { token, decoded, firebaseUid, firebaseUser, email, isAdmin, authProvider }
}


