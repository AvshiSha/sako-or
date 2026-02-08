import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { normalizeIsraelE164, isValidIsraelE164 } from '@/lib/phone'
import { requireUserAuth } from '@/lib/server/auth'
import { triggerInforuAutomation, e164ToLocalPhone } from '@/lib/inforu'

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
  birthday: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid birthday format (expected YYYY-MM-DD)')
    .transform((s) => new Date(`${s}T00:00:00.000Z`))
    .optional(),
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
  birthday: Date
  interestedIn: string | null
  isNewsletter: boolean
}

/**
 * Triggers Inforu isNewsletter automation event
 * @param user - The updated user record from database
 */
async function triggerInforuNewsletterEvent(user: User): Promise<void> {
  try {
    // Convert phone from E.164 format to local format (0XXXXXXXXX)
    const localPhone = e164ToLocalPhone(user.phone)
    if (!localPhone) {
      console.warn('[INFORU NEWSLETTER] Cannot trigger - invalid phone number:', user.phone)
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
      : undefined

    // Convert isNewsletter boolean to string "true" or "false"
    const isNewsletterString = user.isNewsletter ? 'true' : 'false'

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

    console.log('[INFORU NEWSLETTER] Prepared contact data:', {
      phoneNumber: contact.phoneNumber,
      email: contact.email,
      is_newsletter: contact.is_newsletter,
      genderId: contact.genderId,
      birthDate: contact.birthDate
    })

    // Trigger Inforu automation
    const result = await triggerInforuAutomation({
      apiEventName: 'isNewsletter',
      contacts: [contact],
    })

    if (result.success) {
      console.log('[INFORU NEWSLETTER] Successfully triggered isNewsletter event for user:', user.id, `newsletter: ${isNewsletterString}`)
    } else {
      console.error('[INFORU NEWSLETTER] Failed to trigger isNewsletter event:', result.error)
    }
  } catch (error) {
    console.error('[INFORU NEWSLETTER] Error triggering isNewsletter event:', error)
    throw error // Re-throw so caller can handle it
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserAuth(request)
    if (auth instanceof NextResponse) return auth
    const firebaseUid = auth.firebaseUid

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
    const auth = await requireUserAuth(request)
    if (auth instanceof NextResponse) return auth
    const decoded = auth.decoded
    const firebaseUid = auth.firebaseUid

    const json = await request.json().catch(() => ({}))
    const parsed = ProfilePatchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    // Normalize nullable string fields: treat "" as null for optional address/interestedIn.
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
      // phone and birthday are locked for existing users (can only be set during initial creation)
      ...(data.language !== undefined ? { language: data.language } : {}),
      ...(data.interestedIn !== undefined ? { interestedIn: normalizeNullable(data.interestedIn) } : {}),

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
      ...(data.addressCity !== undefined
        ? { addressCity: normalizeNullable(data.addressCity) }
        : {}),

      ...(data.isNewsletter !== undefined ? { isNewsletter: data.isNewsletter } : {})
    }

    // Check if user exists in DB
    const existingUser = await prisma.user.findUnique({
      where: { firebaseUid }
    })

    // Track old newsletter value for change detection
    const oldIsNewsletter = existingUser?.isNewsletter ?? false

    let user
    if (!existingUser) {
      // User doesn't exist yet - this is their first profile save (onboarding)
      // Validate that all required fields are present
      if (!data.firstName || !data.lastName || !data.phone || !data.language || !data.birthday) {
        return NextResponse.json(
          {
            error: 'Required fields missing. firstName, lastName, phone, language, and birthday are required.',
            issues: [
              ...(!data.firstName ? [{ path: ['firstName'], message: 'First name is required' }] : []),
              ...(!data.lastName ? [{ path: ['lastName'], message: 'Last name is required' }] : []),
              ...(!data.phone ? [{ path: ['phone'], message: 'Phone is required' }] : []),
              ...(!data.language ? [{ path: ['language'], message: 'Language is required' }] : []),
              ...(!data.birthday ? [{ path: ['birthday'], message: 'Birthday is required' }] : [])
            ]
          },
          { status: 400 }
        )
      }

      // Get additional fields from Firebase for the initial user creation
      const firebaseUser = auth.firebaseUser
      const emailRaw = firebaseUser.email ?? decoded.email ?? null
      const email = emailRaw ? emailRaw.trim().toLowerCase() : null

      const authProvider = auth.authProvider

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
          birthday: data.birthday!,
          interestedIn: normalizeNullable(data.interestedIn),
          addressStreet: normalizeNullable(data.addressStreet),
          addressStreetNumber: normalizeNullable(data.addressStreetNumber),
          addressFloor: normalizeNullable(data.addressFloor),
          addressApt: normalizeNullable(data.addressApt),
          addressCity: normalizeNullable(data.addressCity),
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

    // Trigger Inforu isNewsletter event if newsletter value changed (only for existing users)
    if (existingUser && data.isNewsletter !== undefined) {
      const newIsNewsletter = user.isNewsletter ?? false
      const newsletterChanged = oldIsNewsletter !== newIsNewsletter

      console.log('[ME_PROFILE] Newsletter change detection:', {
        oldIsNewsletter,
        newIsNewsletter,
        newsletterChanged,
        userId: user.id
      })

      if (newsletterChanged) {
        try {
          await triggerInforuNewsletterEvent(user)
        } catch (error) {
          // Log error but don't fail the profile update process
          console.error('[ME_PROFILE] Failed to trigger Inforu newsletter event:', error)
        }
      }
    }

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


