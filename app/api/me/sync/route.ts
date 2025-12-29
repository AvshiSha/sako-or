import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'

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

    const email = firebaseUser.email ?? decoded.email ?? null
    const phone = firebaseUser.phoneNumber ?? null
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

    const user = await prisma.user.upsert({
      where: { firebaseUid },
      update: {
        lastLoginAt: now,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        emailVerified,
        ...(authProvider ? { authProvider } : {}),
        ...nameUpdate,
        isDelete: false
      },
      create: {
        firebaseUid,
        email,
        emailVerified,
        ...(phone ? { phone } : {}),
        ...(authProvider ? { authProvider } : {}),
        ...nameUpdate,
        role: 'USER',
        lastLoginAt: now,
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
    console.error('[ME_SYNC_ERROR]', error)
    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to sync user'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


