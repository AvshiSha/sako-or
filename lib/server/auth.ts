import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { normalizeEmail, SUPER_ADMIN_EMAIL } from '@/lib/admin'
import { resolveIsAdmin } from '@/lib/server/admin'
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session'
import { verifyAdminSessionCookie } from '@/lib/server/admin-session'

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
  const isAdmin = await resolveIsAdmin(email, firebaseUid)
  const authProvider = pickAuthProvider(firebaseUser, decoded)

  if (authProvider === 'password' && !isAdmin) {
    return NextResponse.json(
      { error: 'Password authentication is disabled. Please sign in using SMS/email code.' },
      { status: 403 }
    )
  }

  return { token, decoded, firebaseUid, firebaseUser, email, isAdmin, authProvider }
}

export async function requireAdmin(
  request: NextRequest
): Promise<AuthedRequestContext | NextResponse> {
  const auth = await requireUserAuth(request)
  if (auth instanceof NextResponse) return auth
  if (!auth.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  return auth
}

export async function requireSuperAdmin(
  request: NextRequest
): Promise<AuthedRequestContext | NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  if (auth.email !== SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
  }
  return auth
}

/**
 * Admin auth accepting EITHER credential: a bearer ID token (what the admin
 * UI's fetches send) or the httpOnly admin session cookie.
 *
 * The cookie path is what lets a route be gated when the caller cannot set a
 * header — most concretely /api/google-drive/callback, which is a top-level
 * navigation back from Google and carries the SameSite=Lax cookie but no
 * Authorization header.
 *
 * Returns the same `AuthedRequestContext | NextResponse` union as the other
 * helpers, so call sites keep the `instanceof NextResponse` idiom unchanged.
 */
export async function requireAdminSession(
  request: NextRequest
): Promise<AuthedRequestContext | NextResponse> {
  if (getBearerToken(request)) {
    return requireAdmin(request)
  }

  const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!cookie) {
    return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 })
  }

  const session = await verifyAdminSessionCookie(cookie)
  if (!session) {
    return NextResponse.json({ error: 'Invalid or expired admin session' }, { status: 401 })
  }

  // Shaped like the bearer path so downstream handlers cannot tell the
  // difference. `token` is empty: there is no ID token on this path, and
  // inventing one would be worse than an obviously absent value.
  const firebaseUser = await adminAuth.getUser(session.uid)
  return {
    token: '',
    decoded: { uid: session.uid, email: session.email },
    firebaseUid: session.uid,
    firebaseUser,
    email: session.email,
    isAdmin: true,
    authProvider: 'session-cookie',
  }
}
