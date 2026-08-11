import 'server-only'
import type { ReviewLanguage, ReviewMessageCopy } from '../review-messages'

/**
 * Delivery channels for the review request.
 *
 * The sending job does not know which transports exist — it asks the registry for the
 * enabled ones and records each result. Adding a channel (or turning one off while
 * its provider-side configuration is pending) touches one file and one env var.
 */

export interface ReviewChannelContext {
  orderNumber: string
  /**
   * Which send attempt this is (1-based). Channels that use provider-side
   * idempotency keys must include it: the message body legitimately changes
   * between attempts (the signed link is re-minted with a new expiry), and a
   * provider that sees the same key with a different body rejects the send
   * instead of deduping it — permanently blocking retries.
   */
  attempt: number
  language: ReviewLanguage
  copy: ReviewMessageCopy
  reviewUrl: string
  signupUrl: string
  isClubMember: boolean
  /** Full name as stored on the order. */
  customerName: string | null
  /**
   * Given name only, already falling back to a language-appropriate default.
   * Channels should prefer this for greetings so provider-side templates address
   * the customer the same way our own email does.
   */
  firstName: string
  customerEmail: string | null
  /** E.164 as stored; channels convert to whatever format they need. */
  customerPhone: string | null
}

export interface ReviewChannelResult {
  channel: string
  ok: boolean
  /** Provider message id, when one is returned. */
  messageId?: string
  /** Set when the channel had nothing to do (no address, not configured). */
  skipped?: boolean
  reason?: string
  error?: string
  /**
   * Provider-side merge-field slots this send wrote to, e.g. "Text27".
   *
   * Recorded because a wrong slot is invisible in the provider's response — Inforu
   * answers "success" either way — so when a message arrives without its link, this
   * is the only stored evidence of where the content was actually put.
   */
  mergeFields?: string
}

export interface ReviewChannel {
  readonly name: string
  /**
   * Whether this channel is configured to run at all. Checked before `send`, so a
   * channel awaiting provider-side setup reports `skipped` rather than `failed` and
   * does not consume the job's retry budget.
   */
  isEnabled(): boolean
  send(context: ReviewChannelContext): Promise<ReviewChannelResult>
}
