import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { z } from 'zod'
import { requireUserAuth } from '@/lib/server/auth'

const LinkEmailSchema = z.object({
  email: z.string().trim().email().toLowerCase()
})

/**
 * POST /api/auth/link-email
 * 
 * Links an email address to the currently authenticated Firebase user.
 * This is used after phone authentication to add email to phone-authenticated users.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserAuth(request)
    if (auth instanceof NextResponse) return auth
    const firebaseUid = auth.firebaseUid

    const json = await request.json().catch(() => ({}))
    const parsed = LinkEmailSchema.safeParse(json)
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const { email } = parsed.data

    // Check if email is already in use
    try {
      const existingUser = await adminAuth.getUserByEmail(email)
      if (existingUser.uid !== firebaseUid) {
        return NextResponse.json(
          { error: 'Email is already in use by another account' },
          { status: 409 }
        )
      }
      // Email already linked to this user
      return NextResponse.json({ ok: true, message: 'Email already linked' }, { status: 200 })
    } catch (err: any) {
      // User not found by email is fine - we can link it
      if (err?.code !== 'auth/user-not-found') {
        throw err
      }
    }

    // Link email to the user
    await adminAuth.updateUser(firebaseUid, {
      email,
      emailVerified: false // Email verification can be done separately if needed
    })

    return NextResponse.json({ ok: true, message: 'Email linked successfully' }, { status: 200 })
  } catch (error: any) {
    console.error('[LINK_EMAIL_ERROR]', error)
    
    if (error?.code === 'auth/email-already-exists') {
      return NextResponse.json(
        { error: 'Email is already in use' },
        { status: 409 }
      )
    }

    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to link email'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

