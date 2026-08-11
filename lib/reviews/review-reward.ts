import 'server-only'
import { prisma } from '../prisma'
import { resolveAccountForOrder } from './account-lookup'

/**
 * The review reward: 20 loyalty points for leaving a review.
 *
 * ## Why the credit is not automatic
 *
 * Points cannot be credited from code. Verifone — the source of truth for balances —
 * exposes no points-write API (`lib/verifone.ts` has exactly three SOAP actions, none
 * of which touch points), and writing to `User.pointsBalance` directly does not
 * survive: `syncAllUserPointsFromVerifone` runs every two hours and performs an
 * absolute set, not a merge (`lib/points.ts:386`), with a second overwriter after any
 * successful invoice (`lib/points.ts:204`). A local `+= 20` disappears within hours.
 *
 * So the reward is an **obligation we record**, fulfilled by a human in
 * /admin/reviews who adds the points in Verifone and records what they did.
 * `creditReviewReward` is the single seam that would change if Verifone ever gains a
 * points-write API — nothing else in the codebase needs to know.
 *
 * ## Why the customer copy says "will be added"
 *
 * Because that is the truth. Telling someone points *have been* added when a human
 * still has to do it invites a support ticket the moment they check their balance.
 */

export const DEFAULT_REVIEW_REWARD_POINTS = 20

export type RewardStatus = 'pending' | 'credited' | 'not_eligible' | 'failed'

/** Points awarded per review, overridable without a deploy. */
export function getReviewRewardPoints(): number {
  const raw = process.env.REVIEW_REWARD_POINTS
  if (!raw) return DEFAULT_REVIEW_REWARD_POINTS
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : DEFAULT_REVIEW_REWARD_POINTS
}

export interface RewardEligibility {
  /** Whether an account exists that the points could land on. */
  isRegistered: boolean
  /** The status this review should be created with. */
  status: Extract<RewardStatus, 'pending' | 'not_eligible'>
  points: number
  userId: string | null
}

/**
 * Decides whether an order's reviewer can be rewarded.
 *
 * Resolved from the order, never from anything the client sent — the browser is not
 * consulted about whether its owner has an account.
 */
export async function resolveRewardEligibility(params: {
  orderId?: string
  orderNumber?: string
}): Promise<RewardEligibility> {
  const account = await resolveAccountForOrder(params)
  const points = getReviewRewardPoints()

  return {
    isRegistered: account.isRegistered,
    status: account.isRegistered ? 'pending' : 'not_eligible',
    points,
    userId: account.userId,
  }
}

export type CreditRewardResult =
  | { ok: true; alreadyCredited: boolean; points: number }
  | { ok: false; reason: 'not_found' | 'not_eligible'; message: string }

/**
 * Marks a review's reward as credited.
 *
 * Idempotency is enforced by a conditional update on `rewardCreditedAt IS NULL`
 * rather than by a read-then-write, so the guarantee holds under concurrency. Every
 * route the brief worries about — a page refresh, a double submit, re-opening the
 * link, registering after the fact, a direct API call — converges on the same single
 * row, and only the first caller sees `count === 1`.
 *
 * Note this does NOT move any balance: see the file header. It records that the
 * obligation has been discharged.
 */
export async function creditReviewReward(params: {
  reviewId: string
  /** Who or what performed the credit — admin email today. */
  transactionId: string
}): Promise<CreditRewardResult> {
  const review = await prisma.review.findUnique({
    where: { id: params.reviewId },
    select: { id: true, rewardStatus: true, rewardPoints: true, rewardCreditedAt: true },
  })

  if (!review) {
    return { ok: false, reason: 'not_found', message: 'Review not found' }
  }

  if (review.rewardStatus === 'not_eligible') {
    return {
      ok: false,
      reason: 'not_eligible',
      message:
        'This review has no account to credit. If the customer has registered since, ' +
        're-check eligibility before paying out.',
    }
  }

  const claimed = await prisma.review.updateMany({
    where: { id: params.reviewId, rewardCreditedAt: null },
    data: {
      rewardStatus: 'credited',
      rewardCreditedAt: new Date(),
      rewardTransactionId: params.transactionId,
      rewardError: null,
    },
  })

  const points = review.rewardPoints ?? getReviewRewardPoints()

  if (claimed.count !== 1) {
    // Someone else got there first. Not an error — the customer is paid either way,
    // and the important thing is that we did not do it twice.
    return { ok: true, alreadyCredited: true, points }
  }

  console.log('[REVIEW_REWARD] Credited', {
    reviewId: params.reviewId,
    points,
    by: params.transactionId,
  })

  return { ok: true, alreadyCredited: false, points }
}

/**
 * Re-evaluates a review that was recorded as ineligible, in case the customer has
 * registered since submitting.
 *
 * This is what makes the brief's "guest reviews, then signs up" case work without the
 * customer resubmitting anything: the next time the admin console or the review page
 * looks at the row, it can promote `not_eligible` to `pending`.
 *
 * Only ever promotes in that one direction. A review already `pending`, `credited` or
 * `failed` is left alone — in particular a credited review can never be walked back
 * into the payout queue.
 */
export async function refreshRewardEligibility(params: {
  reviewId: string
  orderId: string
}): Promise<{ promoted: boolean; status: RewardStatus }> {
  const review = await prisma.review.findUnique({
    where: { id: params.reviewId },
    select: { rewardStatus: true },
  })

  if (!review) return { promoted: false, status: 'not_eligible' }
  if (review.rewardStatus !== 'not_eligible') {
    return { promoted: false, status: review.rewardStatus as RewardStatus }
  }

  const eligibility = await resolveRewardEligibility({ orderId: params.orderId })
  if (!eligibility.isRegistered) {
    return { promoted: false, status: 'not_eligible' }
  }

  // Guarded so two concurrent page loads cannot both "promote" it.
  const updated = await prisma.review.updateMany({
    where: { id: params.reviewId, rewardStatus: 'not_eligible' },
    data: {
      rewardStatus: 'pending',
      rewardPoints: eligibility.points,
      userId: eligibility.userId,
    },
  })

  if (updated.count === 1) {
    console.log('[REVIEW_REWARD] Promoted to pending after registration', {
      reviewId: params.reviewId,
      points: eligibility.points,
    })
  }

  return { promoted: updated.count === 1, status: 'pending' }
}
