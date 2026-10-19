import 'server-only'

import { prisma } from '@/lib/prisma'
import { ADMIN_ROLE, STAFF_ROLE, normalizeEmail } from '@/lib/admin'
import { resolveIsAdmin } from '@/lib/server/admin'

/**
 * Who may use the warehouse screen, and in which capacity.
 *
 * Mirrors `resolveIsAdmin` in `lib/server/admin.ts`: resolved on every request
 * from the database rather than trusted from a cookie or a custom claim, so
 * revoking access takes effect on the next request instead of whenever the
 * session happens to expire.
 *
 * Admins pass as 'ADMIN'. That is not a convenience -- the role is what decides
 * whether the manager PIN is required, and it is recorded in the location
 * history, so the two cannot be collapsed into a boolean.
 *
 * The reverse does not hold: `resolveIsAdmin` does not consult STAFF_ROLE, so
 * the shared warehouse account can never satisfy an admin check anywhere in the
 * application.
 */
export type StaffRole = typeof ADMIN_ROLE | typeof STAFF_ROLE

export async function resolveStaffAccess(
  email: string | null | undefined,
  firebaseUid?: string | null
): Promise<StaffRole | null> {
  // Admin first: an admin is always allowed in, and should be recorded as an
  // admin even if their user row also happened to say STAFF.
  if (await resolveIsAdmin(email, firebaseUid)) return ADMIN_ROLE

  if (firebaseUid) {
    const user = await prisma.user.findUnique({
      where: { firebaseUid },
      select: { role: true, isDelete: true },
    })
    if (user && !user.isDelete && user.role === STAFF_ROLE) return STAFF_ROLE
  }

  const normalized = normalizeEmail(email)
  if (normalized) {
    const user = await prisma.user.findUnique({
      where: { email: normalized },
      select: { role: true, isDelete: true },
    })
    if (user && !user.isDelete && user.role === STAFF_ROLE) return STAFF_ROLE
  }

  return null
}
