import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminAuth } from '@/lib/firebase-admin'
import { requireUserAuth } from '@/lib/server/auth'

/**
 * POST /api/auth/cancel-signup
 * 
 * Cancels an incomplete signup by:
 * 1. Deleting any partial/unconfirmed Neon user row
 * 2. Deleting the Firebase Auth user
 * 
 * This is called when a user starts signup but abandons it before completing
 * all required fields + SMS verification.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserAuth(request)
    if (auth instanceof NextResponse) return auth
    const firebaseUid = auth.firebaseUid

    // Check if user exists in Neon
    const neonUser = await prisma.user.findUnique({
      where: { firebaseUid },
      select: {
        id: true,
        signupCompletedAt: true,
        phoneVerifiedAt: true,
        firstName: true,
        lastName: true,
        phone: true,
        language: true
      }
    })

    // If user is already confirmed (has completed signup), don't allow cancellation
    if (neonUser?.signupCompletedAt) {
      return NextResponse.json(
        { error: 'Cannot cancel a completed signup' },
        { status: 400 }
      )
    }

    // If user has all required fields and is verified, also don't allow cancellation
    const hasRequiredFields = neonUser?.firstName && neonUser?.lastName && neonUser?.phone && neonUser?.language
    if (neonUser && hasRequiredFields && neonUser.phoneVerifiedAt) {
      return NextResponse.json(
        { error: 'Cannot cancel a completed signup' },
        { status: 400 }
      )
    }

    // Delete Neon user if exists (partial/unconfirmed user)
    if (neonUser) {
      await prisma.user.delete({
        where: { firebaseUid }
      })
      console.log('[CANCEL_SIGNUP] Deleted partial Neon user:', neonUser.id)
    }

    // Delete Firebase Auth user
    try {
      await adminAuth.deleteUser(firebaseUid)
      console.log('[CANCEL_SIGNUP] Deleted Firebase Auth user:', firebaseUid)
    } catch (firebaseError: any) {
      // If Firebase user doesn't exist or is already deleted, that's fine
      if (firebaseError?.code !== 'auth/user-not-found') {
        throw firebaseError
      }
    }

    return NextResponse.json(
      { ok: true, message: 'Signup cancelled successfully' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[CANCEL_SIGNUP_ERROR]', error)
    const message =
      typeof error?.message === 'string' ? error.message : 'Unable to cancel signup'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

