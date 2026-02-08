import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { normalizeIsraelE164, isValidIsraelE164 } from '@/lib/phone'

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase()
}

const PrecheckSchema = z.object({
  email: z.string().min(1, 'Email is required'),
  phone: z.string().min(1, 'Phone number is required')
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => ({}))
    const parsed = PrecheckSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid payload', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const email = normalizeEmail(parsed.data.email)
    const phoneE164 = normalizeIsraelE164(parsed.data.phone)

    const fieldErrors: Record<string, string> = {}

    // Email format validation (simple but effective)
    const emailOk = z.string().email().safeParse(email).success
    if (!emailOk) {
      fieldErrors.email = 'Email must look like name@example.com'
    }

    // Phone validation: E.164 format for Israel
    if (!phoneE164) {
      fieldErrors.phone = 'Enter a valid Israeli phone number'
    } else if (!isValidIsraelE164(phoneE164)) {
      fieldErrors.phone = 'Enter a valid Israeli phone number in format +972501234567'
    }

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json({ ok: false, errors: fieldErrors }, { status: 400 })
    }

    // Check uniqueness across any rows (email and phone can be in different rows).
    const [emailUser, phoneUser] = await Promise.all([
      prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true }
      }),
      prisma.user.findFirst({
        where: { phone: phoneE164 },
        select: { id: true }
      })
    ])

    const existsErrors: Record<string, string> = {}
    if (emailUser) existsErrors.email = 'Email is already in use'
    if (phoneUser) existsErrors.phone = 'Phone number is already in use'

    if (Object.keys(existsErrors).length > 0) {
      return NextResponse.json({ ok: false, errors: existsErrors }, { status: 409 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error('[PRECHECK_SIGNUP_ERROR]', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to precheck signup' },
      { status: 500 }
    )
  }
}


