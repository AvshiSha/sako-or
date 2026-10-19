/**
 * Central place for admin authorization rules (client-safe).
 */

export const ADMIN_ROLE = 'ADMIN' as const

/**
 * The shared warehouse viewer role, stored in Prisma `users.role` exactly as
 * ADMIN_ROLE is.
 *
 * It grants the warehouse stock screen and nothing else -- it is deliberately
 * NOT a weaker admin. Location changes on top of it need the manager PIN, and
 * no admin surface accepts it. `resolveStaffAccess` in `lib/server/staff.ts` is
 * the only thing that reads it; `resolveIsAdmin` does not, so a STAFF account
 * can never satisfy an admin check.
 */
export const STAFF_ROLE = 'STAFF' as const

/** Every role value `users.role` is allowed to hold. */
export type UserRole = 'USER' | typeof ADMIN_ROLE | typeof STAFF_ROLE

export const ADMIN_EMAILS = [
  'admin@sako-or.com',
  'manager@sako-or.com',
  'avshisakoor@gmail.com', // Firebase emails are always lowercase
] as const

export const SUPER_ADMIN_EMAIL = 'avshisakoor@gmail.com' as const

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const trimmed = email.trim().toLowerCase()
  return trimmed.length ? trimmed : null
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  return (ADMIN_EMAILS as readonly string[]).includes(normalized)
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === ADMIN_ROLE
}

export function isStaffRole(role: string | null | undefined): boolean {
  return role === STAFF_ROLE
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email)
  return normalized === SUPER_ADMIN_EMAIL
}
