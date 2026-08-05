import 'server-only'
import { Resend } from 'resend'
import ReviewRequestEmail from '../../../app/emails/review-request'
import type { ReviewChannel, ReviewChannelContext, ReviewChannelResult } from './types'

/**
 * Review request by email, via Resend.
 *
 * Deliberately does NOT reuse `sendOrderConfirmationEmailIdempotent`: that helper
 * keys idempotency off `order.emailSentAt`, which the purchase confirmation already
 * set, so it would report `skipped` for every order and never send. Idempotency for
 * review requests belongs to the `review_requests` row (claimed via a conditional
 * UPDATE), not to a column shared with a different email.
 */

const SEND_TIMEOUT_MS = 15000

let resendClient: Resend | null = null

/** Lazy singleton, matching the pattern in `lib/email.ts`. */
function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    throw new Error('RESEND_API_KEY environment variable is not set')
  }
  if (!resendClient) {
    resendClient = new Resend(key)
  }
  return resendClient
}

export const emailReviewChannel: ReviewChannel = {
  name: 'email',

  isEnabled(): boolean {
    return Boolean(process.env.RESEND_API_KEY)
  },

  async send(context: ReviewChannelContext): Promise<ReviewChannelResult> {
    if (!context.customerEmail) {
      return { channel: 'email', ok: false, skipped: true, reason: 'Order has no email' }
    }

    try {
      const resend = getResendClient()
      const isHebrew = context.language === 'he'

      const sendPromise = resend.emails.send(
        {
          from: 'Sako Or <info@sako-or.com>',
          to: [context.customerEmail],
          subject: context.copy.subject,
          react: ReviewRequestEmail({
            greeting: context.copy.greeting,
            body: context.copy.body,
            ctaLabel: context.copy.ctaLabel,
            reviewUrl: context.reviewUrl,
            signupLabel: context.copy.signupLabel,
            signupUrl: context.isClubMember ? null : context.signupUrl,
            closing: context.copy.closing,
            previewText: context.copy.subject,
            isHebrew,
          }),
          text: context.copy.plainText,
        },
        {
          // Stable key (no timestamp suffix): if this job is retried after an
          // ambiguous failure, Resend itself suppresses the duplicate. That is a
          // second line of defence behind the DB claim, not the primary guard.
          idempotencyKey: `review-request-${context.orderNumber}`,
        }
      )

      const raced = await Promise.race([
        sendPromise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Resend API timeout after ${SEND_TIMEOUT_MS}ms`)),
            SEND_TIMEOUT_MS
          )
        ),
      ])

      // Racing against a Promise<never> collapses the inferred type to `never`, so
      // the shape is reasserted here. `lib/email.ts` does the same, with `any`.
      const { data, error } = raced as {
        data?: { id?: string } | null
        error?: { message?: string; name?: string } | string | null
      }

      if (error) {
        return {
          channel: 'email',
          ok: false,
          error: typeof error === 'string' ? error : error.message ?? JSON.stringify(error),
        }
      }

      return { channel: 'email', ok: true, messageId: data?.id }
    } catch (error) {
      return {
        channel: 'email',
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
}
