import 'server-only'
import { e164ToLocalPhone, triggerInforuAutomation } from '../../inforu'
import type { InforuCustomFieldName } from '../../inforu'
import type { ReviewChannel, ReviewChannelContext, ReviewChannelResult } from './types'

/**
 * Review request via an Inforu automation.
 *
 * Inforu's Automation API does not accept a message body — the text lives in the
 * console and pulls per-recipient values from the contact's numbered merge fields
 * (TextN). So this channel's job is to hand Inforu the signed review link under the
 * exact slot the console maps; the template decides the wording and whether it goes
 * out as SMS or WhatsApp.
 *
 * Everything is env-configurable because the field mapping is defined on Inforu's
 * side ("Automation API control") and must match exactly — a field we send under a
 * name the template does not reference renders as empty text, silently.
 *
 * The channel stays disabled until INFORU_REVIEW_EVENT_NAME is set, so an
 * unconfigured automation is reported as skipped rather than burning retries.
 */

function getEventName(): string | null {
  return process.env.INFORU_REVIEW_EVENT_NAME?.trim() || null
}

/**
 * The single merge field carrying the review link.
 *
 * Only one dynamic value is sent. The order number is already available as
 * `ContactRefId`, and the loyalty signup URL is a constant that belongs in the
 * template text rather than in a per-contact field. Keeping this to one field
 * matters because Inforu's custom fields are stored on the *contact record*, so
 * every field we write is a field we could be overwriting for other purposes.
 *
 * The slot number is ACCOUNT-SPECIFIC. Inforu numbers a customer's custom fields by
 * their position in that account's schema, so there is no universal "first" slot —
 * ours is Text27, not Text1. Getting this wrong fails in the worst possible way:
 * Inforu accepts the trigger and answers `StatusId: 1, Records: 1`, so the send looks
 * completely successful, while the template renders with an empty link. Nothing in
 * the API response distinguishes the two cases; only the absent SMS does.
 */
function getReviewUrlField(): InforuCustomFieldName {
  return (process.env.INFORU_REVIEW_URL_FIELD?.trim() || 'Text27') as InforuCustomFieldName
}

/**
 * Optional second field carrying the order number.
 *
 * Off by default: the order number already reaches Inforu as `ContactRefId`, so this
 * is only needed if the message text must *display* it and their template engine
 * cannot merge ContactRefId. Opt in by naming a field slot, so we do not write to a
 * contact field nobody reads.
 */
function getOrderNumberField(): InforuCustomFieldName | null {
  const field = process.env.INFORU_REVIEW_ORDER_FIELD?.trim()
  return field ? (field as InforuCustomFieldName) : null
}

/** Warn only once per process, so a misconfiguration is visible but not noisy. */
let warnedMissingNonMemberEvent = false

/**
 * Club members and non-members get different copy, and that copy lives in Inforu.
 * The two audiences are therefore routed to two separate automations rather than one
 * template branching on a field.
 */
function resolveEventName(isClubMember: boolean): string | null {
  const base = getEventName()
  if (!base) return null

  if (isClubMember) return base

  const nonMemberEvent = process.env.INFORU_REVIEW_EVENT_NAME_NON_MEMBER?.trim()
  if (nonMemberEvent) return nonMemberEvent

  // Falling back to the member automation still sends something useful, but the
  // customer loses the loyalty signup prompt — and with it the points they were
  // promised for reviewing. Worth surfacing rather than silently degrading.
  if (!warnedMissingNonMemberEvent) {
    warnedMissingNonMemberEvent = true
    console.warn(
      '[REVIEW_REQUEST] INFORU_REVIEW_EVENT_NAME_NON_MEMBER is not set — non-members ' +
        'will receive the club-member message with no signup link.'
    )
  }

  return base
}

export const inforuReviewChannel: ReviewChannel = {
  name: 'inforu',

  isEnabled(): boolean {
    return getEventName() !== null
  },

  async send(context: ReviewChannelContext): Promise<ReviewChannelResult> {
    const eventName = resolveEventName(context.isClubMember)

    if (!eventName) {
      return {
        channel: 'inforu',
        ok: false,
        skipped: true,
        reason: 'INFORU_REVIEW_EVENT_NAME is not configured',
      }
    }

    // Inforu expects the local Israeli format, not E.164.
    const phone = e164ToLocalPhone(context.customerPhone)

    if (!phone && !context.customerEmail) {
      return {
        channel: 'inforu',
        ok: false,
        skipped: true,
        reason: 'No phone or email for contact',
      }
    }

    const orderNumberField = getOrderNumberField()

    const customFields: Partial<Record<InforuCustomFieldName, string>> = {
      [getReviewUrlField()]: context.reviewUrl,
    }
    if (orderNumberField) {
      customFields[orderNumberField] = context.orderNumber
    }

    try {
      const result = await triggerInforuAutomation({
        apiEventName: eventName,
        contacts: [
          {
            phoneNumber: phone ?? '',
            email: context.customerEmail ?? undefined,
            // Given name only, matching the greeting in our own email template.
            firstName: context.firstName || undefined,
            // Carries the order number, and lets Inforu correlate the send back to it.
            contactRefId: context.orderNumber,
            customFields,
          },
        ],
      })

      if (!result.success) {
        return {
          channel: 'inforu',
          ok: false,
          error:
            typeof result.error === 'string' ? result.error : JSON.stringify(result.error),
        }
      }

      // Record WHICH slots were written. A wrong slot is indistinguishable from a
      // correct one in Inforu's response, so the field names are the only evidence
      // available when a message arrives without its link.
      const fieldsUsed = Object.keys(customFields).join(', ')
      console.log('[REVIEW_REQUEST] Inforu triggered', {
        event: eventName,
        mergeFields: fieldsUsed,
      })

      return {
        channel: 'inforu',
        ok: true,
        messageId: result.messageId,
        mergeFields: fieldsUsed,
      }
    } catch (error) {
      return {
        channel: 'inforu',
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
}
