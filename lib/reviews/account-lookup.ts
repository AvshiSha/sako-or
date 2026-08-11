import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { normalizeIsraelE164 } from '../phone'

/**
 * Resolving which registered account, if any, belongs to an order.
 *
 * `Order.userId` is only ever set at checkout and is never back-linked afterwards,
 * so it answers this question for a minority of orders — roughly 9% at the time of
 * writing; the rest are guest checkouts with `userId = NULL`. Any feature that asks
 * "is this customer registered?" therefore has to fall back to contact details, or
 * it will report "guest" for people who have had an account for months.
 *
 * The phone comparison is the part that silently goes wrong if written naively:
 * `orders.customerPhone` stores the local Israeli format (`05XXXXXXXX`) while
 * `users.phone` stores E.164 (`+9725XXXXXXXX`). A direct column comparison matches
 * almost nothing — measured against production data it found 1 match out of 1131
 * guest orders, versus 64 by email. Everything here goes through
 * `normalizeIsraelE164` for that reason.
 *
 * Matching by contact details assumes the person who registered is the person who
 * ordered. For a shared household email that can over-match; it is acceptable here
 * because the only consequence is showing someone a loyalty-points offer, and the
 * payout itself is reviewed by a human in /admin/reviews.
 */

/** How the account was found, for display and debugging. */
export type AccountMatchSource = 'order_user' | 'email' | 'phone'

export interface ResolvedAccount {
  isRegistered: boolean
  /** Neon `User.id`. Null when no account matched. */
  userId: string | null
  matchedBy: AccountMatchSource | null
  /** True when found by contact details rather than `Order.userId` — i.e. the
   *  customer almost certainly registered *after* placing this order. */
  joinedAfterOrder: boolean
  pointsBalance: Prisma.Decimal | null
  verifoneCustomerNo: string | null
  /** The account's phone in E.164, when an account was found. */
  phone: string | null
}

const NO_ACCOUNT: ResolvedAccount = {
  isRegistered: false,
  userId: null,
  matchedBy: null,
  joinedAfterOrder: false,
  pointsBalance: null,
  verifoneCustomerNo: null,
  phone: null,
}

const ACCOUNT_FIELDS = {
  id: true,
  email: true,
  phone: true,
  pointsBalance: true,
  verifoneCustomerNo: true,
} as const

type AccountRow = {
  id: string
  email: string | null
  phone: string | null
  pointsBalance: Prisma.Decimal
  verifoneCustomerNo: string | null
}

function toResolved(
  account: AccountRow,
  matchedBy: AccountMatchSource
): ResolvedAccount {
  return {
    isRegistered: true,
    userId: account.id,
    matchedBy,
    joinedAfterOrder: matchedBy !== 'order_user',
    pointsBalance: account.pointsBalance,
    verifoneCustomerNo: account.verifoneCustomerNo,
    phone: account.phone,
  }
}

/**
 * Finds the registered account behind a single order.
 *
 * Resolution order — most authoritative first:
 *   1. `Order.userId`      the order was placed while signed in
 *   2. email               case-insensitive
 *   3. phone               normalised to E.164 before comparing
 */
export async function resolveAccountForOrder(params: {
  orderId?: string
  orderNumber?: string
}): Promise<ResolvedAccount> {
  if (!params.orderId && !params.orderNumber) return NO_ACCOUNT

  const order = await prisma.order.findFirst({
    where: params.orderId ? { id: params.orderId } : { orderNumber: params.orderNumber },
    select: {
      customerEmail: true,
      customerPhone: true,
      user: { select: ACCOUNT_FIELDS },
    },
  })

  if (!order) return NO_ACCOUNT
  if (order.user) return toResolved(order.user, 'order_user')

  const email = order.customerEmail?.trim().toLowerCase() || null
  const phone = normalizeIsraelE164(order.customerPhone)

  if (!email && !phone) return NO_ACCOUNT

  // Email first: it matched ~64x more guest orders than phone in production, and an
  // email is far less likely than a phone number to be recycled between people.
  if (email) {
    const byEmail = await prisma.user.findFirst({
      where: { email },
      select: ACCOUNT_FIELDS,
    })
    if (byEmail) return toResolved(byEmail, 'email')
  }

  if (phone) {
    const byPhone = await prisma.user.findFirst({
      where: { phone },
      select: ACCOUNT_FIELDS,
    })
    if (byPhone) return toResolved(byPhone, 'phone')
  }

  return NO_ACCOUNT
}

/**
 * Batch variant for list screens.
 *
 * Takes the contact details of many orders and returns a lookup keyed by
 * `email:<lowercased>` and `phone:<e164>`, so a caller can resolve each row without
 * issuing a query per row. Used by the admin reviews console.
 */
export async function resolveAccountsByContact(
  contacts: { email: string | null; phone: string | null }[]
): Promise<Map<string, AccountRow>> {
  const emails = new Set<string>()
  const phones = new Set<string>()

  for (const contact of contacts) {
    const email = contact.email?.trim().toLowerCase()
    if (email) emails.add(email)
    const e164 = normalizeIsraelE164(contact.phone)
    if (e164) phones.add(e164)
  }

  if (emails.size === 0 && phones.size === 0) return new Map()

  const users = await prisma.user.findMany({
    where: {
      OR: [
        ...(emails.size > 0 ? [{ email: { in: [...emails] } }] : []),
        ...(phones.size > 0 ? [{ phone: { in: [...phones] } }] : []),
      ],
    },
    select: ACCOUNT_FIELDS,
  })

  // Keyed under both identifiers so either one resolves the same account.
  const byKey = new Map<string, AccountRow>()
  for (const user of users) {
    if (user.email) byKey.set(`email:${user.email.toLowerCase()}`, user)
    if (user.phone) byKey.set(`phone:${user.phone}`, user)
  }
  return byKey
}

/** Looks one order's contact details up in a map from `resolveAccountsByContact`. */
export function lookupAccount(
  byKey: Map<string, AccountRow>,
  contact: { email: string | null; phone: string | null }
): AccountRow | null {
  const email = contact.email?.trim().toLowerCase()
  const phone = normalizeIsraelE164(contact.phone)

  return (
    (email ? byKey.get(`email:${email}`) : undefined) ??
    (phone ? byKey.get(`phone:${phone}`) : undefined) ??
    null
  )
}
