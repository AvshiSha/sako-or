/**
 * Grants or revokes the shared warehouse viewer role.
 *
 *   npx tsx scripts/grant-staff-role.ts --email warehouse@sako-or.com
 *   npx tsx scripts/grant-staff-role.ts --email warehouse@sako-or.com --revoke
 *
 * A script rather than an admin screen, deliberately: this is a one-off
 * deployment step for a single shared account, and a UI for it would be a UI
 * for handing out warehouse access.
 *
 * ## Why this is needed at all
 *
 * `users.birthday` is NOT NULL, so the row cannot simply be inserted by hand
 * without inventing a birthday, and every ordinary creation path
 * (`/api/me/sync`, `/api/auth/complete-signup`, `/api/me/profile`) hardcodes
 * `role: 'USER'`. This script finds the existing Firebase user, links it to a
 * `users` row by `firebase_uid`, and sets the role.
 *
 * The Firebase account must already exist, with a password, created in the
 * Firebase console. This script does not create accounts: minting credentials
 * is not something a repo script should be able to do.
 *
 * Revoking sets the role back to 'USER'. It refuses to touch an ADMIN row, so a
 * mistyped email cannot demote an administrator.
 */

import 'dotenv/config'

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as admin from 'firebase-admin'

import { ADMIN_ROLE, STAFF_ROLE, normalizeEmail } from '../lib/admin'

/**
 * Argument parsing that survives npm.
 *
 * `npm run staff:grant -- --email x@y.z` does NOT forward `--email`: npm claims
 * unknown `--flags` as its own config ("Unknown cli config") and passes through
 * only the bare value. So both spellings are accepted -- a `--email <address>`
 * flag for direct `npx tsx` use, and a bare positional address for the npm
 * path. `--revoke` is accepted as a bare `revoke` for the same reason.
 */
const args = process.argv.slice(2)

function flagValue(name: string): string | undefined {
  const index = args.indexOf(`--${name}`)
  if (index !== -1) return args[index + 1]
  const inline = args.find((value) => value.startsWith(`--${name}=`))
  return inline ? inline.slice(name.length + 3) : undefined
}

/** The email, however it arrived. */
function emailArgument(): string | undefined {
  return (
    flagValue('email') ??
    // A bare address: anything that is not a flag and looks like an email.
    args.find((value) => !value.startsWith('-') && value.includes('@'))
  )
}

function hasRevokeFlag(): boolean {
  return args.some((value) => value === '--revoke' || value === 'revoke')
}

function initFirebase() {
  if (admin.apps.length) return admin.app()

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY'
    )
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  })
}

async function main() {
  const email = normalizeEmail(emailArgument())
  const revoke = hasRevokeFlag()

  if (!email) {
    console.error('Usage:')
    console.error('  npm run staff:grant -- <address> [revoke]')
    console.error('  npx tsx scripts/grant-staff-role.ts --email <address> [--revoke]')
    console.error('')
    console.error('npm claims a leading --email as its own config, so when going')
    console.error('through npm pass the address on its own after the -- separator.')
    process.exit(1)
  }

  initFirebase()

  // Same driver adapter as lib/prisma.ts. A plain `new PrismaClient()` is not
  // valid in Prisma 7 with driver adapters configured. DIRECT_URL rather than
  // DATABASE_URL because this is a one-off script, not pooled request traffic.
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('Missing DIRECT_URL / DATABASE_URL')
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

  try {
    // The Firebase account is the identity; the users row only carries the role.
    const firebaseUser = await admin
      .auth()
      .getUserByEmail(email)
      .catch(() => null)

    if (!firebaseUser) {
      console.error(
        `No Firebase user for ${email}. Create the account in the Firebase console first ` +
          '(Authentication > Users > Add user), then re-run this.'
      )
      process.exit(1)
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ firebaseUid: firebaseUser.uid }, { email }] },
      select: { id: true, email: true, role: true, firebaseUid: true },
    })

    if (revoke) {
      if (!existing) {
        console.log(`Nothing to revoke: no users row for ${email}.`)
        return
      }
      if (existing.role === ADMIN_ROLE) {
        console.error(
          `Refusing to change ${email}: it is an ADMIN. Use the admin users screen for that.`
        )
        process.exit(1)
      }
      await prisma.user.update({ where: { id: existing.id }, data: { role: 'USER' } })
      console.log(`Revoked warehouse access for ${email} (role is now USER).`)
      return
    }

    if (existing) {
      if (existing.role === ADMIN_ROLE) {
        console.log(
          `${email} is an ADMIN and already has warehouse access; leaving the role unchanged.`
        )
        return
      }

      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: STAFF_ROLE,
          // Link the row to the Firebase account if it was not already, since
          // `resolveStaffAccess` prefers the uid lookup.
          firebaseUid: existing.firebaseUid ?? firebaseUser.uid,
          isDelete: false,
        },
      })
      console.log(`${email} now has warehouse access (role STAFF).`)
      return
    }

    await prisma.user.create({
      data: {
        email,
        firebaseUid: firebaseUser.uid,
        role: STAFF_ROLE,
        authProvider: 'password',
        // `birthday` is NOT NULL on this table and is meaningless for a shared
        // operational account. A fixed epoch date makes it obvious in the data
        // that it was never a real person's birthday.
        birthday: new Date('1970-01-01T00:00:00.000Z'),
        emailVerified: true,
      },
    })

    console.log(`Created a users row for ${email} with role STAFF.`)
    console.log(
      'Next: set STAFF_MANAGER_PIN_HASH (scripts/hash-staff-pin.ts) so location edits are possible.'
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('[GRANT_STAFF_ROLE] failed', error)
  process.exit(1)
})
