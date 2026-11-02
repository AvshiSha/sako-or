import 'server-only'

import { prisma } from '@/lib/prisma'
import {
  ADMIN_ROLE,
  CONTENT_EDITOR_ROLE,
  isAdminEmail,
  normalizeEmail,
  parseContentEditorEmails,
} from '@/lib/admin'

/**
 * Authorization for the MCP SEO content endpoint.
 *
 * Mirrors `resolveIsAdmin` in lib/server/admin.ts -- the database is re-read on
 * every request rather than trusting a claim baked into a token, so a withdrawn
 * role takes effect within one access-token lifetime instead of one refresh
 * lifetime.
 *
 * Two conditions, both required:
 *
 *   1. MCP_CONTENT_EDITOR_EMAILS lists the email. This is the real gate, and it
 *      is deliberately a short, hand-maintained list; and
 *   2. the account is already trusted with this content -- either it holds
 *      CONTENT_EDITOR, or it is an admin (by the hardcoded ADMIN_EMAILS list or
 *      by `users.role`).
 *
 * Admins are accepted, which an earlier version of this file refused on the
 * theory that an admin token "widens what a leaked MCP credential is worth".
 * That reasoning was wrong: an MCP token can only call the eight tools in
 * lib/mcp/tools, so a token issued to an admin is exactly as powerful as one
 * issued to a content editor. Refusing admins bought no security and cost real
 * things -- it would have required demoting a live admin account to grant
 * access, and `avshisakoor@gmail.com` has no `users` row at all (it is an admin
 * purely through ADMIN_EMAILS), so there was nothing to set a role on.
 *
 * Requiring both conditions still means neither a stray database edit nor an
 * env-var typo alone opens the endpoint, and the allowlist caps who can ever
 * pass regardless of how many admins the site has.
 */
export interface ContentRole {
  email: string
  /** How the account qualified, for the audit log and the diagnostics script. */
  via: 'admin' | 'content_editor'
}

export async function resolveContentRole(
  email: string | null | undefined
): Promise<ContentRole | null> {
  const normalized = normalizeEmail(email)
  if (!normalized) return null

  const allowed = parseContentEditorEmails(process.env.MCP_CONTENT_EDITOR_EMAILS)
  if (!allowed.includes(normalized)) return null

  // Checked before the database, because a hardcoded admin need not have a
  // `users` row -- and one of the two configured addresses does not have one.
  if (isAdminEmail(normalized)) {
    return { email: normalized, via: 'admin' }
  }

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { role: true, isDelete: true },
  })
  if (!user || user.isDelete) return null

  if (user.role === ADMIN_ROLE) return { email: normalized, via: 'admin' }
  if (user.role === CONTENT_EDITOR_ROLE) return { email: normalized, via: 'content_editor' }

  return null
}

/**
 * True when the MCP endpoint is switched on.
 *
 * Fail-closed, matching `verifyChatbaseRequest`: an unset variable means the
 * integration is not configured, and every MCP route 404s rather than serving
 * an unauthenticated surface. Checked at the route boundary, not inside the
 * tools, so a misconfiguration cannot leave half of it reachable.
 */
export function isMcpEnabled(): boolean {
  return process.env.MCP_ENABLED === 'true'
}
