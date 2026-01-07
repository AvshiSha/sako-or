import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'
import { normalizeIsraelE164, isValidIsraelE164 } from '@/lib/phone'

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

function computeNeedsProfileCompletion(user: {
  firstName: string | null
  lastName: string | null
  phone: string | null
  language: string | null
}): boolean {
  return !user.firstName || !user.lastName || !user.phone || !user.language
}

const ProfilePatchSchema = z.object({
  firstName: z.string().trim().min(1).max(50).optional(),
  lastName: z.string().trim().min(1).max(50).optional(),
  phone: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .transform((raw) => normalizeIsraelE164(raw))
    .refine((e164) => e164 && isValidIsraelE164(e164), {
      message: 'Invalid phone. Use Israeli E.164 format: +972501234567'
    })
    .optional(),
  language: z.enum(['en', 'he']).optional(),
  gender: z.string().trim().max(30).optional().nullable(),

  addressStreet: z.string().trim().max(120).optional().nullable(),
  addressStreetNumber: z.string().trim().max(20).optional().nullable(),
  addressFloor: z.string().trim().max(20).optional().nullable(),
  addressApt: z.string().trim().max(20).optional().nullable(),

  isNewsletter: z.boolean().optional()
})

export async function GET(request: NextRequest) {
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

    const user = await prisma.user.findUnique({
      where: { firebaseUid }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Profile not found. Please complete your profile first.' },
        { status: 404 }
      )
    }

    const needsProfileCompletion = computeNeedsProfileCompletion({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      language: user.language
    })

    return NextResponse.json(
      { ok: true, user, needsProfileCompletion },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[ME_PROFILE_GET_ERROR]', error)
    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to load profile'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
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

    const json = await request.json().catch(() => ({}))
    const parsed = ProfilePatchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    // Normalize nullable string fields: treat "" as null for optional address/gender.
    const data = parsed.data
    const normalizeNullable = (v: string | null | undefined) => {
      if (v === undefined) return undefined
      if (v === null) return null
      const t = v.trim()
      return t.length === 0 ? null : t
    }

    const updateData = {
      ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.language !== undefined ? { language: data.language } : {}),
      ...(data.gender !== undefined ? { gender: normalizeNullable(data.gender) } : {}),

      ...(data.addressStreet !== undefined
        ? { addressStreet: normalizeNullable(data.addressStreet) }
        : {}),
      ...(data.addressStreetNumber !== undefined
        ? { addressStreetNumber: normalizeNullable(data.addressStreetNumber) }
        : {}),
      ...(data.addressFloor !== undefined
        ? { addressFloor: normalizeNullable(data.addressFloor) }
        : {}),
      ...(data.addressApt !== undefined
        ? { addressApt: normalizeNullable(data.addressApt) }
        : {}),

      ...(data.isNewsletter !== undefined ? { isNewsletter: data.isNewsletter } : {})
    }

    // Check if user exists in DB
    const existingUser = await prisma.user.findUnique({
      where: { firebaseUid }
    })

    let user
    if (!existingUser) {
      // User doesn't exist yet - this is their first profile save (onboarding)
      // Validate that all required fields are present
      if (!data.firstName || !data.lastName || !data.phone || !data.language) {
        return NextResponse.json(
          {
            error: 'Required fields missing. firstName, lastName, phone, and language are required.',
            issues: [
              ...(!data.firstName ? [{ path: ['firstName'], message: 'First name is required' }] : []),
              ...(!data.lastName ? [{ path: ['lastName'], message: 'Last name is required' }] : []),
              ...(!data.phone ? [{ path: ['phone'], message: 'Phone is required' }] : []),
              ...(!data.language ? [{ path: ['language'], message: 'Language is required' }] : [])
            ]
          },
          { status: 400 }
        )
      }

      // Get additional fields from Firebase for the initial user creation
      const firebaseUser = await adminAuth.getUser(firebaseUid)
      const emailRaw = firebaseUser.email ?? decoded.email ?? null
      const email = emailRaw ? emailRaw.trim().toLowerCase() : null

      const providerIds =
        firebaseUser.providerData?.map((p) => p.providerId).filter(Boolean) ?? []
      const authProvider =
        providerIds.length > 0
          ? providerIds[0]
          : ((decoded as any)?.firebase?.sign_in_provider as string | undefined) ?? 'firebase'

      const emailVerified = firebaseUser.emailVerified ?? (decoded.email_verified ?? false)

      // Create the user with all required fields
      user = await prisma.user.create({
        data: {
          firebaseUid,
          email,
          emailVerified,
          authProvider,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          language: data.language,
          gender: normalizeNullable(data.gender),
          addressStreet: normalizeNullable(data.addressStreet),
          addressStreetNumber: normalizeNullable(data.addressStreetNumber),
          addressFloor: normalizeNullable(data.addressFloor),
          addressApt: normalizeNullable(data.addressApt),
          isNewsletter: data.isNewsletter ?? false,
          role: 'USER',
          lastLoginAt: new Date(),
          isDelete: false
        }
      })
    } else {
      // User exists - update with provided fields
      user = await prisma.user.update({
        where: { firebaseUid },
        data: updateData
      })
    }

    const needsProfileCompletion = computeNeedsProfileCompletion({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      language: user.language
    })

    return NextResponse.json(
      { ok: true, user, needsProfileCompletion },
      { status: 200 }
    )
  } catch (error: any) {
    // Prisma unique constraint violation
    if (error?.code === 'P2002') {
      const target = error?.meta?.target
      const targetStr = Array.isArray(target) ? target.join(',') : String(target ?? '')
      if (targetStr.includes('phone')) {
        return NextResponse.json(
          { error: 'Phone number is already in use' },
          { status: 409 }
        )
      }
      if (targetStr.includes('email')) {
        return NextResponse.json(
          { error: 'Email is already in use' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: 'Conflict: unique constraint violation' },
        { status: 409 }
      )
    }

    console.error('[ME_PROFILE_PATCH_ERROR]', error)
    const message =
      typeof error?.message === 'string'
        ? error.message
        : 'Unable to update profile'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


