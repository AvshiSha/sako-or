import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'
import {
  ADMIN_EMAILS,
  ADMIN_ROLE,
  normalizeEmail,
  SUPER_ADMIN_EMAIL,
} from '@/lib/admin'
import { requireAdmin, requireSuperAdmin } from '@/lib/server/auth'

const ADMIN_PLACEHOLDER_BIRTHDAY = new Date('1970-01-01T00:00:00.000Z')

const createAdminUserSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const deleteAdminUserSchema = z.object({
  email: z.string().trim().email(),
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

function getDeleteMetadata(
  targetEmail: string | null,
  options: {
    canDeleteAdmins: boolean
    requesterEmail: string | null
    isLegacy: boolean
  }
): { deletable: boolean; notDeletableReason?: string } {
  const { canDeleteAdmins, requesterEmail, isLegacy } = options
  const normalizedTarget = normalizeEmail(targetEmail)

  if (!canDeleteAdmins) {
    return { deletable: false }
  }

  if (isLegacy) {
    return { deletable: false, notDeletableReason: 'Legacy admin' }
  }

  if (normalizedTarget === SUPER_ADMIN_EMAIL) {
    return { deletable: false, notDeletableReason: 'Owner account' }
  }

  if (normalizedTarget && normalizedTarget === requesterEmail) {
    return { deletable: false, notDeletableReason: 'Your account' }
  }

  return { deletable: true }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (auth instanceof NextResponse) return auth

    const canDeleteAdmins = auth.email === SUPER_ADMIN_EMAIL

    const dbAdmins = await prisma.user.findMany({
      where: { role: ADMIN_ROLE, isDelete: false },
      select: {
        id: true,
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
      .map((email) => {
        const deleteMeta = getDeleteMetadata(email, {
          canDeleteAdmins,
          requesterEmail: auth.email,
          isLegacy: true,
        })
        return {
          email,
          firstName: null,
          lastName: null,
          createdAt: null,
          lastLoginAt: null,
          isLegacy: true,
          ...deleteMeta,
        }
      })

    const users = [
      ...dbAdmins.map((u) => {
        const deleteMeta = getDeleteMetadata(u.email, {
          canDeleteAdmins,
          requesterEmail: auth.email,
          isLegacy: false,
        })
        return { ...u, isLegacy: false, ...deleteMeta }
      }),
      ...legacyAdmins,
    ]

    return NextResponse.json({ ok: true, canDeleteAdmins, users })
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

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)
    if (auth instanceof NextResponse) return auth

    const body = await request.json().catch(() => ({}))
    const parsed = deleteAdminUserSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const email = normalizeEmail(parsed.data.email)
    if (!email) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }

    if (email === SUPER_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Cannot revoke admin access for the owner account.' },
        { status: 400 }
      )
    }

    if (email === auth.email) {
      return NextResponse.json(
        { error: 'Cannot revoke your own admin access.' },
        { status: 400 }
      )
    }

    const isLegacyOnly =
      (ADMIN_EMAILS as readonly string[]).includes(email) &&
      !(await prisma.user.findFirst({
        where: { email, role: ADMIN_ROLE, isDelete: false },
        select: { id: true },
      }))

    if (isLegacyOnly) {
      return NextResponse.json(
        { error: 'Legacy admin accounts cannot be revoked from the admin panel.' },
        { status: 400 }
      )
    }

    const targetUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, isDelete: true },
    })

    if (!targetUser || targetUser.isDelete) {
      return NextResponse.json({ error: 'Admin user not found.' }, { status: 404 })
    }

    if (targetUser.role !== ADMIN_ROLE) {
      return NextResponse.json(
        { error: 'This user does not have admin access.' },
        { status: 400 }
      )
    }

    await prisma.user.update({
      where: { id: targetUser.id },
      data: { role: 'USER' },
    })

    return NextResponse.json({
      ok: true,
      email,
      role: 'USER',
    })
  } catch (error) {
    console.error('[ADMIN_USERS_DELETE_ERROR]', error)
    return NextResponse.json({ error: 'Failed to revoke admin access' }, { status: 500 })
  }
}
