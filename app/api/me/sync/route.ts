import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'
import { normalizeIsraelE164 } from '@/lib/phone'

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase()
}

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

function parseDisplayName(displayName: string | null | undefined): {
  firstName: string | null
  lastName: string | null
} {
  if (!displayName) return { firstName: null, lastName: null }
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return { firstName: null, lastName: null }
  if (parts.length === 1) return { firstName: parts[0], lastName: null }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function computeNeedsProfileCompletion(user: {
  firstName: string | null
  lastName: string | null
  phone: string | null
  language: string | null
}): boolean {
  return !user.firstName || !user.lastName || !user.phone || !user.language
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request)
    if (!token) {
      return NextResponse.json(
        { error: 'Missing Authorization Bearer token' },
        { status: 401 }
      )
    }

    const decoded = await adminAuth.verifyIdToken(token)
    const firebaseUid = decoded.uid
    const now = new Date()

    const firebaseUser = await adminAuth.getUser(firebaseUid)

    const emailRaw = firebaseUser.email ?? decoded.email ?? null
    const email = emailRaw ? normalizeEmail(emailRaw) : null

    // Normalize phone to E.164 format for consistency
    const phone = normalizeIsraelE164(firebaseUser.phoneNumber)
    const emailVerified = firebaseUser.emailVerified ?? (decoded.email_verified ?? false)

    const providerIds =
      firebaseUser.providerData?.map((p) => p.providerId).filter(Boolean) ?? []
    const authProvider =
      providerIds.length > 0
        ? providerIds[0]
        : ((decoded as any)?.firebase?.sign_in_provider as string | undefined) ??
          'firebase'

    const { firstName: parsedFirstName, lastName: parsedLastName } =
      parseDisplayName(firebaseUser.displayName)

    // Only set parsed name if present; do not blank existing values.
    const nameUpdate: { firstName?: string; lastName?: string } = {}
    if (parsedFirstName) nameUpdate.firstName = parsedFirstName
    if (parsedLastName) nameUpdate.lastName = parsedLastName

    // Find existing user - do NOT create on sync
    const existingUser = await prisma.user.findUnique({
      where: { firebaseUid }
    })

    // If user doesn't exist in DB yet, return early with needsProfileCompletion = true
    // The user will be created when they submit the profile form via /api/me/profile PATCH
    if (!existingUser) {
      return NextResponse.json(
        {
          ok: true,
          needsProfileCompletion: true,
          user: null,
          id: null,
          firebaseUid,
          email,
          role: 'USER',
          lastLoginAt: null,
          createdAt: null,
          updatedAt: null
        },
        { status: 200 }
      )
    }

    // User exists - update login metadata
    const user = await prisma.user.update({
      where: { firebaseUid },
      data: {
        lastLoginAt: now,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        emailVerified,
        ...(authProvider ? { authProvider } : {}),
        ...nameUpdate,
        isDelete: false
      }
    })

    const needsProfileCompletion = computeNeedsProfileCompletion({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      language: user.language
    })

    return NextResponse.json(
      {
        ok: true,
        user,
        needsProfileCompletion,
        id: user.id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      { status: 200 }
    )
  } catch (error: any) {
    // Prisma unique constraint violation
    if (error?.code === 'P2002') {
      const target = error?.meta?.target
      const targetStr = Array.isArray(target) ? target.join(',') : String(target ?? '')
      if (targetStr.includes('email')) {
        return NextResponse.json({ error: 'Email is already in use' }, { status: 409 })
      }
      if (targetStr.includes('phone')) {
        return NextResponse.json({ error: 'Phone number is already in use' }, { status: 409 })
      }
      if (targetStr.includes('firebaseUid') || targetStr.includes('firebase_uid')) {
        return NextResponse.json({ error: 'User already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Conflict: unique constraint violation' }, { status: 409 })
    }

    console.error('[ME_SYNC_ERROR]', error)
    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to sync user'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


