import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'
import { normalizeIsraelE164, isValidIsraelE164 } from '@/lib/phone'
import { requireUserAuth } from '@/lib/server/auth'
import { triggerInforuAutomation, e164ToLocalPhone } from '@/lib/inforu'
import { getVerifoneCustomerByCellular } from '@/lib/verifone'

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
  birthday: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid birthday format (expected YYYY-MM-DD)')
    .transform((s) => new Date(`${s}T00:00:00.000Z`)),
  interestedIn: z.string().trim().max(30).optional().nullable(),
  addressStreet: z.string().trim().max(120).optional().nullable(),
  addressStreetNumber: z.string().trim().max(20).optional().nullable(),
  addressFloor: z.string().trim().max(20).optional().nullable(),
  addressApt: z.string().trim().max(20).optional().nullable(),
  addressCity: z.string().trim().max(100).optional().nullable(),
  isNewsletter: z.boolean().optional()
})

type User = {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  pointsBalance: number
  birthday: Date
  interestedIn: string | null
  isNewsletter: boolean
}

type SignupData = z.infer<typeof CompleteSignupSchema>

/**
 * Triggers Inforu welcomeCustomerClub automation event
 * @param user - The completed user record from database
 * @param data - The signup data from request
 */
async function triggerInforuWelcomeEvent(user: User, data: SignupData): Promise<void> {
  try {
    // Convert phone from E.164 format to local format (0XXXXXXXXX)
    const localPhone = e164ToLocalPhone(user.phone || data.phone)
    if (!localPhone) {
      console.warn('[INFORU WELCOME] Cannot trigger - invalid phone number:', user.phone)
      return
    }

    // Map interestedIn to GenderId
    // mens → 1 (male), womens → 2 (female), both/null → omit
    let genderId: number | undefined
    if (user.interestedIn === 'mens') {
      genderId = 1
    } else if (user.interestedIn === 'womens') {
      genderId = 2
    }
    // Omit GenderId for 'both' or null

    // Format birthday as YYYY-MM-DD string
    const birthDate = user.birthday instanceof Date
      ? user.birthday.toISOString().split('T')[0]
      : data.birthday instanceof Date
        ? data.birthday.toISOString().split('T')[0]
        : undefined

    // Convert isNewsletter boolean to string "true" or "false"
    const isNewsletterString = (user.isNewsletter ?? data.isNewsletter ?? false) ? 'true' : 'false'

    // Prepare contact data for Inforu
    const contact = {
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      email: user.email || undefined,
      phoneNumber: localPhone,
      genderId: genderId,
      birthDate: birthDate,
      is_newsletter: isNewsletterString,
    }

    // Trigger Inforu automation
    const result = await triggerInforuAutomation({
      apiEventName: 'welcomeCustomerClub',
      contacts: [contact],
    })

    if (result.success) {
      console.log('[INFORU WELCOME] Successfully triggered welcomeCustomerClub event for user:', user.id)
    } else {
      console.error('[INFORU WELCOME] Failed to trigger welcomeCustomerClub event:', result.error)
    }
  } catch (error) {
    console.error('[INFORU WELCOME] Error triggering welcomeCustomerClub event:', error)
    throw error // Re-throw so caller can handle it
  }
}

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
    const auth = await requireUserAuth(request)
    if (auth instanceof NextResponse) return auth
    const decoded = auth.decoded
    const firebaseUid = auth.firebaseUid

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
    const firebaseUser = auth.firebaseUser

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

    // Track if this is a new completion (for Inforu trigger)
    const wasAlreadyCompleted = existingUser?.signupCompletedAt !== null && existingUser?.signupCompletedAt !== undefined

    if (existingUser) {
      // If user already exists and is confirmed, return success
      if (existingUser.signupCompletedAt) {
        // Return a new custom token for client-side re-authentication
        const customToken = await adminAuth.createCustomToken(firebaseUid)
        return NextResponse.json(
          { ok: true, user: existingUser, message: 'User already exists', customToken },
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
          birthday: data.birthday,
          interestedIn: data.interestedIn || null,
          addressStreet: data.addressStreet || null,
          addressStreetNumber: data.addressStreetNumber || null,
          addressFloor: data.addressFloor || null,
          addressApt: data.addressApt || null,
          addressCity: data.addressCity || null,
          isNewsletter: data.isNewsletter ?? false,
          phoneVerifiedAt: now,
          signupCompletedAt: now,
          lastLoginAt: now
        }
      })

      // Sync Verifone club points for this user (non-blocking on failure)
      try {
        const verifoneResult = await getVerifoneCustomerByCellular(user.phone)

        if (
          verifoneResult.success &&
          verifoneResult.customer &&
          verifoneResult.customer.isClubMember
        ) {
          const verifonePoints = Math.max(
            0,
            verifoneResult.customer.creditPoints || 0
          )

          if (verifonePoints > 0) {
            await prisma.user.update({
              where: { id: user.id },
              data: { pointsBalance: verifonePoints }
            })

            console.log(
              '[VERIFONE_GET_CUSTOMERS] Synced points for existing user',
              {
                userId: user.id,
                verifonePoints,
                status: verifoneResult.status,
                statusDescription: verifoneResult.statusDescription
              }
            )
          } else {
            console.log(
              '[VERIFONE_GET_CUSTOMERS] Club member with zero points for existing user',
              {
                userId: user.id,
                status: verifoneResult.status,
                statusDescription: verifoneResult.statusDescription
              }
            )
          }
        } else {
          console.log(
            '[VERIFONE_GET_CUSTOMERS] No Verifone club customer or lookup failed for existing user',
            {
              userId: user.id,
              hasCustomer: !!verifoneResult.customer,
              status: verifoneResult.status,
              statusDescription: verifoneResult.statusDescription
            }
          )
        }
      } catch (verifoneError) {
        console.error(
          '[VERIFONE_GET_CUSTOMERS] Error syncing points for existing user',
          verifoneError
        )
      }

      // Trigger Inforu welcome event for newly completed signup
      if (!wasAlreadyCompleted) {
        try {
          await triggerInforuWelcomeEvent(user, data)
        } catch (error) {
          // Log error but don't fail the signup process
          console.error('[COMPLETE_SIGNUP] Failed to trigger Inforu welcome event:', error)
        }
      }

      // Return a new custom token for client-side re-authentication
      // This helps if the client auth was cleared after signInWithCustomToken
      const customToken = await adminAuth.createCustomToken(firebaseUid)

      return NextResponse.json(
        { ok: true, user, customToken },
        { status: 200 }
      )
    }

    // Create new user in Neon
    const emailRaw = firebaseUser.email ?? decoded.email ?? null
    const email = emailRaw ? emailRaw.trim().toLowerCase() : null
    const emailVerified = firebaseUser.emailVerified ?? (decoded.email_verified ?? false)

    const authProvider = auth.authProvider

    const now = new Date()
    // Create new user in Neon with initial zero points; we may overwrite
    // pointsBalance with Verifone data right after creation.
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
        birthday: data.birthday,
        interestedIn: data.interestedIn || null,
        addressStreet: data.addressStreet || null,
        addressStreetNumber: data.addressStreetNumber || null,
        addressFloor: data.addressFloor || null,
        addressApt: data.addressApt || null,
        addressCity: data.addressCity || null,
        isNewsletter: data.isNewsletter ?? false,
        phoneVerifiedAt: now,
        signupCompletedAt: now,
        role: 'USER',
        lastLoginAt: now,
        isDelete: false
      }
    })

    // Sync Verifone club points for this newly created user (non-blocking on failure)
    try {
      const verifoneResult = await getVerifoneCustomerByCellular(user.phone)

      if (
        verifoneResult.success &&
        verifoneResult.customer &&
        verifoneResult.customer.isClubMember
      ) {
        const verifonePoints = Math.max(
          0,
          verifoneResult.customer.creditPoints || 0
        )

        if (verifonePoints > 0) {
          await prisma.user.update({
            where: { id: user.id },
            data: { pointsBalance: verifonePoints }
          })

          console.log(
            '[VERIFONE_GET_CUSTOMERS] Synced points for new user',
            {
              userId: user.id,
              verifonePoints,
              status: verifoneResult.status,
              statusDescription: verifoneResult.statusDescription
            }
          )
        } else {
          console.log(
            '[VERIFONE_GET_CUSTOMERS] Club member with zero points for new user',
            {
              userId: user.id,
              status: verifoneResult.status,
              statusDescription: verifoneResult.statusDescription
            }
          )
        }
      } else {
        console.log(
          '[VERIFONE_GET_CUSTOMERS] No Verifone club customer or lookup failed for new user',
          {
            userId: user.id,
            hasCustomer: !!verifoneResult.customer,
            status: verifoneResult.status,
            statusDescription: verifoneResult.statusDescription
          }
        )
      }
    } catch (verifoneError) {
      console.error(
        '[VERIFONE_GET_CUSTOMERS] Error syncing points for new user',
        verifoneError
      )
    }

    // Trigger Inforu welcome event for newly completed signup
    try {
      await triggerInforuWelcomeEvent(user, data)
    } catch (error) {
      // Log error but don't fail the signup process
      console.error('[COMPLETE_SIGNUP] Failed to trigger Inforu welcome event:', error)
    }

    // Return a new custom token for client-side re-authentication
    // This helps if the client auth was cleared after signInWithCustomToken
    const customToken = await adminAuth.createCustomToken(firebaseUid)

    return NextResponse.json(
      { ok: true, user, customToken },
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

