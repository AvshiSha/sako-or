import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'
import { ADMIN_EMAILS, ADMIN_ROLE, normalizeEmail } from '@/lib/admin'
import { requireAdmin } from '@/lib/server/auth'

const ADMIN_PLACEHOLDER_BIRTHDAY = new Date('1970-01-01T00:00:00.000Z')

const createAdminUserSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

function mapFirebaseAuthError(error: { code?: string; message?: string }) {
  switch (error.code) {
    case 'auth/email-already-exists':
      return { status: 409, message: 'Email is already in use.' }
    case 'auth/invalid-password':
      return { status: 400, message: 'Password must be at least 6 characters.' }
    case 'auth/invalid-email':
      return { status: 400, message: 'Invalid email address.' }
    default:
      return { status: 500, message: 'Failed to create admin user in Firebase.' }
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (auth instanceof NextResponse) return auth

    const dbAdmins = await prisma.user.findMany({
      where: { role: ADMIN_ROLE, isDelete: false },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const dbEmails = new Set(
      dbAdmins.map((u) => normalizeEmail(u.email)).filter(Boolean) as string[]
    )

    const legacyAdmins = (ADMIN_EMAILS as readonly string[])
      .filter((email) => !dbEmails.has(email))
      .map((email) => ({
        email,
        firstName: null,
        lastName: null,
        createdAt: null,
        lastLoginAt: null,
        isLegacy: true,
      }))

    const users = [
      ...dbAdmins.map((u) => ({ ...u, isLegacy: false })),
      ...legacyAdmins,
    ]

    return NextResponse.json({ ok: true, users })
  } catch (error) {
    console.error('[ADMIN_USERS_LIST_ERROR]', error)
    return NextResponse.json({ error: 'Failed to fetch admin users' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json().catch(() => ({}))
    const parsed = createAdminUserSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const email = normalizeEmail(parsed.data.email)
    if (!email) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }

    const { password } = parsed.data

    let firebaseUid: string
    let created = false
    let emailVerified = false

    try {
      const existingFirebaseUser = await adminAuth.getUserByEmail(email)
      firebaseUid = existingFirebaseUser.uid
      emailVerified = existingFirebaseUser.emailVerified ?? false
      await adminAuth.updateUser(firebaseUid, { password })
    } catch (error: any) {
      if (error?.code === 'auth/user-not-found') {
        const newUser = await adminAuth.createUser({
          email,
          password,
          emailVerified: false,
        })
        firebaseUid = newUser.uid
        created = true
        emailVerified = newUser.emailVerified ?? false
      } else {
        const mapped = mapFirebaseAuthError(error)
        console.error('[ADMIN_USERS_CREATE_FIREBASE_ERROR]', error)
        return NextResponse.json({ error: mapped.message }, { status: mapped.status })
      }
    }

    const existingByEmail = await prisma.user.findUnique({ where: { email } })
    const existingByUid = await prisma.user.findUnique({ where: { firebaseUid } })

    if (
      existingByEmail &&
      existingByUid &&
      existingByEmail.id !== existingByUid.id
    ) {
      return NextResponse.json(
        { error: 'Email and Firebase account conflict. Contact support.' },
        { status: 409 }
      )
    }

    const existing = existingByUid ?? existingByEmail

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            email,
            firebaseUid,
            role: ADMIN_ROLE,
            authProvider: 'password',
            emailVerified,
            isDelete: false,
          },
        })
      : await prisma.user.create({
          data: {
            email,
            firebaseUid,
            role: ADMIN_ROLE,
            authProvider: 'password',
            emailVerified,
            birthday: ADMIN_PLACEHOLDER_BIRTHDAY,
            isDelete: false,
          },
        })

    return NextResponse.json({
      ok: true,
      user: {
        email: user.email,
        role: user.role,
        firebaseUid: user.firebaseUid,
        created,
      },
    })
  } catch (error: any) {
    if (typeof error?.code === 'string' && error.code.startsWith('auth/')) {
      const mapped = mapFirebaseAuthError(error)
      return NextResponse.json({ error: mapped.message }, { status: mapped.status })
    }

    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Email is already in use.' }, { status: 409 })
    }

    console.error('[ADMIN_USERS_CREATE_ERROR]', error)
    return NextResponse.json({ error: 'Failed to create admin user' }, { status: 500 })
  }
}
