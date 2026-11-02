/**
 * Inspect and set the CONTENT_EDITOR role for the MCP SEO content integration.
 *
 * Exists because granting this role is a production write to the `users` table
 * and `UPDATE users SET role = ...` is one forgotten WHERE clause away from
 * re-roling every account on the site. This script cannot express that mistake:
 * it resolves one exact email to one user id, refuses to proceed if the email
 * matches anything other than a single row, prints the before and after, and
 * does nothing at all unless `--apply` is passed.
 *
 * It also refuses any email that is not in MCP_CONTENT_EDITOR_EMAILS, so the
 * database and the env var cannot drift apart -- `resolveContentRole` requires
 * both, and a role granted to an unlisted address would be invisible dead
 * permission.
 *
 * Usage:
 *   npx tsx scripts/mcp-content-editors.ts                        # report only
 *   npx tsx scripts/mcp-content-editors.ts --grant her@email      # dry run
 *   npx tsx scripts/mcp-content-editors.ts --grant her@email --apply
 *   npx tsx scripts/mcp-content-editors.ts --revoke her@email --apply
 */

import 'dotenv/config'

import { prisma } from '@/lib/prisma'
import {
  ADMIN_ROLE,
  CONTENT_EDITOR_ROLE,
  isAdminEmail,
  normalizeEmail,
  parseContentEditorEmails,
} from '@/lib/admin'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')

function flagValue(flag: string): string | null {
  const index = args.indexOf(flag)
  if (index === -1) return null
  return args[index + 1] ?? null
}

interface UserRow {
  id: string
  email: string | null
  role: string
  isDelete: boolean
  firebaseUid: string | null
}

async function findExactlyOne(email: string): Promise<UserRow> {
  // findMany, not findUnique: the point is to *prove* the email matches one row
  // before anything is written, and a unique lookup would quietly hide a
  // duplicate if the constraint ever changed.
  const matches = await prisma.user.findMany({
    where: { email },
    select: { id: true, email: true, role: true, isDelete: true, firebaseUid: true },
  })

  if (matches.length === 0) {
    throw new Error(
      `No user row for ${email}. She must sign in to the storefront at least once ` +
        'so the account exists before the role can be granted.'
    )
  }
  if (matches.length > 1) {
    throw new Error(
      `${matches.length} user rows share ${email} (ids: ${matches.map((m) => m.id).join(', ')}). ` +
        'Refusing to guess which one to change.'
    )
  }
  return matches[0]
}

async function report(): Promise<void> {
  const allowlist = parseContentEditorEmails(process.env.MCP_CONTENT_EDITOR_EMAILS)

  console.log('MCP_CONTENT_EDITOR_EMAILS:')
  if (allowlist.length === 0) {
    console.log('  (unset — the MCP endpoint authorizes nobody)')
  } else {
    for (const email of allowlist) console.log(`  ${email}`)
  }

  console.log('\nAccounts for those addresses:')
  for (const email of allowlist) {
    // Checked before the database, exactly as resolveContentRole does: an
    // address in the hardcoded ADMIN_EMAILS list is authorized whether or not
    // it has a `users` row, and one of the configured addresses has none.
    if (isAdminEmail(email)) {
      console.log(`  ${email}: hardcoded ADMIN_EMAILS -> authorized (admin), no user row needed`)
      continue
    }

    const matches = await prisma.user.findMany({
      where: { email },
      select: { id: true, role: true, isDelete: true, firebaseUid: true },
    })
    if (matches.length === 0) {
      console.log(`  ${email}: NO USER ROW and not a hardcoded admin -> NOT authorized`)
      continue
    }
    for (const row of matches) {
      const effective =
        row.role === ADMIN_ROLE
          ? 'authorized (admin)'
          : row.role === CONTENT_EDITOR_ROLE
            ? 'authorized (content editor)'
            : `NOT authorized (role is ${row.role})`
      console.log(
        `  ${email}: id=${row.id} role=${row.role}` +
          `${row.isDelete ? ' DELETED' : ''}` +
          `${row.firebaseUid ? '' : ' (no firebaseUid)'} -> ${effective}`
      )
    }
  }

  // Anyone holding the role who is NOT on the allowlist has dead permission
  // that nothing grants and nothing checks. Worth surfacing.
  const holders = await prisma.user.findMany({
    where: { role: CONTENT_EDITOR_ROLE },
    select: { id: true, email: true },
  })
  console.log(`\nAccounts with role = ${CONTENT_EDITOR_ROLE}: ${holders.length}`)
  for (const holder of holders) {
    const listed = holder.email && allowlist.includes(holder.email)
    console.log(`  ${holder.email ?? '(no email)'} id=${holder.id}${listed ? '' : '  <-- NOT on the allowlist'}`)
  }
}

async function change(email: string, nextRole: string): Promise<void> {
  const allowlist = parseContentEditorEmails(process.env.MCP_CONTENT_EDITOR_EMAILS)
  if (nextRole === CONTENT_EDITOR_ROLE && !allowlist.includes(email)) {
    throw new Error(
      `${email} is not in MCP_CONTENT_EDITOR_EMAILS. Add it there first, or the role ` +
        'grants nothing — resolveContentRole requires both.'
    )
  }

  const user = await findExactlyOne(email)

  console.log(`\nTarget: exactly one row`)
  console.log(`  id:    ${user.id}`)
  console.log(`  email: ${user.email}`)
  console.log(`  role:  ${user.role} -> ${nextRole}`)
  if (user.isDelete) {
    throw new Error('That account is soft-deleted. Refusing to grant it a role.')
  }

  if (isAdminEmail(email) || user.role === ADMIN_ROLE) {
    // Changing an admin's stored role is never necessary and is a good way to
    // lose admin access the day the hardcoded ADMIN_EMAILS list changes.
    console.log(
      `\n  ${email} is an admin. resolveContentRole already authorizes admins that are on\n` +
        '  the allowlist, so no role change is needed or wanted. Nothing to do.'
    )
    return
  }

  if (user.role === nextRole) {
    console.log('\n  Already set. Nothing to do.')
    return
  }

  if (!APPLY) {
    console.log('\n  DRY RUN. Re-run with --apply to write this change.')
    return
  }

  // Scoped to the resolved primary key, not the email, so the statement can
  // only ever touch the row printed above.
  const result = await prisma.user.updateMany({
    where: { id: user.id },
    data: { role: nextRole },
  })

  if (result.count !== 1) {
    throw new Error(`Expected to update exactly 1 row, updated ${result.count}. Investigate.`)
  }

  const after = await findExactlyOne(email)
  console.log(`\n  Updated 1 row. ${after.email} role is now ${after.role}.`)
}

async function main() {
  const grant = flagValue('--grant')
  const revoke = flagValue('--revoke')

  try {
    if (grant) {
      const email = normalizeEmail(grant)
      if (!email) throw new Error('--grant needs an email address.')
      await change(email, CONTENT_EDITOR_ROLE)
    } else if (revoke) {
      const email = normalizeEmail(revoke)
      if (!email) throw new Error('--revoke needs an email address.')
      await change(email, 'USER')
    }

    console.log('')
    await report()
  } catch (error) {
    console.error(`\nERROR: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

void main()
