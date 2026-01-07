/**
 * Central place for admin authorization rules.
 *
 * Note: in production, consider storing admins/roles in your database or Firebase custom claims.
 */

export const ADMIN_EMAILS = [
  'admin@sako-or.com',
  'manager@sako-or.com',
  'avshisakoor@gmail.com', // Firebase emails are always lowercase
  // Add more admin emails here
] as const

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


