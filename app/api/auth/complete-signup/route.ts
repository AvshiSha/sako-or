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

const CompleteSignupSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  phone: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .transform((raw) => normalizeIsraelE164(raw))
    .refine((e164) => e164 && isValidIsraelE164(e164), {
      message: 'Invalid phone. Use Israeli E.164 format: +972501234567'
    }),
  language: z.enum(['en', 'he']),
  gender: z.string().trim().max(30).optional().nullable(),
  addressStreet: z.string().trim().max(120).optional().nullable(),
  addressStreetNumber: z.string().trim().max(20).optional().nullable(),
  addressFloor: z.string().trim().max(20).optional().nullable(),
  addressApt: z.string().trim().max(20).optional().nullable(),
  isNewsletter: z.boolean().optional()
})

/**
 * POST /api/auth/complete-signup
 * 
 * Completes signup by creating a Neon user row ONLY after:
 * 1. Firebase Auth user has a verified phone number attached
 * 2. All required profile fields are provided
 * 
 * This ensures no partial users exist in Neon.
 */
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

    // Parse and validate request body
    const json = await request.json().catch(() => ({}))
    const parsed = CompleteSignupSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Fetch Firebase user to verify phone number is attached
    const firebaseUser = await adminAuth.getUser(firebaseUid)
    
    if (!firebaseUser.phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not verified. Please complete SMS verification first.' },
        { status: 400 }
      )
    }

    // Verify that Firebase phone matches the provided phone
    const firebasePhoneE164 = normalizeIsraelE164(firebaseUser.phoneNumber || '')
    if (!firebasePhoneE164 || firebasePhoneE164 !== data.phone) {
      return NextResponse.json(
        { 
          error: 'Phone number mismatch. The verified phone does not match the provided phone.',
          details: { firebasePhone: firebasePhoneE164, providedPhone: data.phone }
        },
        { status: 400 }
      )
    }

    // Check if user already exists in Neon
    const existingUser = await prisma.user.findUnique({
      where: { firebaseUid }
    })

    if (existingUser) {
      // If user already exists and is confirmed, return success
      if (existingUser.signupCompletedAt) {
        return NextResponse.json(
          { ok: true, user: existingUser, message: 'User already exists' },
          { status: 200 }
        )
      }
      
      // User exists but isn't confirmed - update it
      const now = new Date()
      const user = await prisma.user.update({
        where: { firebaseUid },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          language: data.language,
          gender: data.gender || null,
          addressStreet: data.addressStreet || null,
          addressStreetNumber: data.addressStreetNumber || null,
          addressFloor: data.addressFloor || null,
          addressApt: data.addressApt || null,
          isNewsletter: data.isNewsletter ?? false,
          phoneVerifiedAt: now,
          signupCompletedAt: now,
          lastLoginAt: now
        }
      })

      return NextResponse.json(
        { ok: true, user },
        { status: 200 }
      )
    }

    // Create new user in Neon
    const emailRaw = firebaseUser.email ?? decoded.email ?? null
    const email = emailRaw ? emailRaw.trim().toLowerCase() : null
    const emailVerified = firebaseUser.emailVerified ?? (decoded.email_verified ?? false)

    const providerIds =
      firebaseUser.providerData?.map((p) => p.providerId).filter(Boolean) ?? []
    const authProvider =
      providerIds.length > 0
        ? providerIds[0]
        : ((decoded as any)?.firebase?.sign_in_provider as string | undefined) ?? 'firebase'

    const now = new Date()
    const user = await prisma.user.create({
      data: {
        firebaseUid,
        email,
        emailVerified,
        authProvider,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        language: data.language,
        gender: data.gender || null,
        addressStreet: data.addressStreet || null,
        addressStreetNumber: data.addressStreetNumber || null,
        addressFloor: data.addressFloor || null,
        addressApt: data.addressApt || null,
        isNewsletter: data.isNewsletter ?? false,
        phoneVerifiedAt: now,
        signupCompletedAt: now,
        role: 'USER',
        lastLoginAt: now,
        isDelete: false
      }
    })

    return NextResponse.json(
      { ok: true, user },
      { status: 201 }
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

    console.error('[COMPLETE_SIGNUP_ERROR]', error)
    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to complete signup'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

