/**
 * Central place for admin authorization rules (client-safe).
 */

export const ADMIN_ROLE = 'ADMIN' as const

export const ADMIN_EMAILS = [
  'admin@sako-or.com',
  'manager@sako-or.com',
  'avshisakoor@gmail.com', // Firebase emails are always lowercase
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

export function isAdminRole(role: string | null | undefined): boolean {
  return role === ADMIN_ROLE
}
