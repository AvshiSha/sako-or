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

/**
 * The SEO content role, stored in Prisma `users.role` exactly as ADMIN_ROLE is.
 *
 * It exists only to authorize the MCP content endpoint (`/api/mcp`): blog
 * articles, the editorial/SEO fields of existing categories, and images for
 * those two. Like STAFF_ROLE it is deliberately NOT a weaker admin --
 * `resolveIsAdmin` does not read it, so a CONTENT_EDITOR account can never
 * satisfy an admin check, and `resolveStaffAccess` does not read it either.
 * `resolveContentRole` in `lib/server/content-role.ts` is the only thing that
 * does, and it additionally requires the account to be named in
 * MCP_CONTENT_EDITOR_EMAILS -- the role alone is not enough.
 */
export const CONTENT_EDITOR_ROLE = 'CONTENT_EDITOR' as const

/** Every role value `users.role` is allowed to hold. */
export type UserRole =
  | 'USER'
  | typeof ADMIN_ROLE
  | typeof STAFF_ROLE
  | typeof CONTENT_EDITOR_ROLE

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

export function isContentEditorRole(role: string | null | undefined): boolean {
  return role === CONTENT_EDITOR_ROLE
}

/**
 * Parse MCP_CONTENT_EDITOR_EMAILS.
 *
 * Lives here rather than in the server half so the same parser covers the env
 * var and its tests without pulling Prisma into the test process. Reading the
 * variable itself stays on the server.
 */
export function parseContentEditorEmails(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((entry) => normalizeEmail(entry))
    .filter((entry): entry is string => entry !== null)
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email)
  return normalized === SUPER_ADMIN_EMAIL
}
