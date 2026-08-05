import 'server-only'
import { e164ToLocalPhone, triggerInforuAutomation } from '../../inforu'
import type { InforuCustomFieldName } from '../../inforu'
import type { ReviewChannel, ReviewChannelContext, ReviewChannelResult } from './types'

/**
 * Review request via an Inforu automation.
 *
 * Inforu's Automation API does not accept a message body — the text lives in the
 * console and pulls per-recipient values from the contact's merge fields
 * (Text1..Text20 etc). So this channel's job is to hand Inforu the signed review link
 * and the supporting values under the agreed field names; the console template
 * decides the wording and whether it goes out as SMS or WhatsApp.
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

/** Field mapping, overridable to match whatever the Inforu console expects. */
function getFieldNames(): {
  reviewUrl: InforuCustomFieldName
  orderNumber: InforuCustomFieldName
  signupUrl: InforuCustomFieldName
} {
  return {
    reviewUrl: (process.env.INFORU_REVIEW_URL_FIELD?.trim() ||
      'Text1') as InforuCustomFieldName,
    orderNumber: (process.env.INFORU_REVIEW_ORDER_FIELD?.trim() ||
      'Text2') as InforuCustomFieldName,
    signupUrl: (process.env.INFORU_REVIEW_SIGNUP_FIELD?.trim() ||
      'Text3') as InforuCustomFieldName,
  }
}

/**
 * Club members and non-members need different copy, and the text lives in Inforu.
 * If a separate non-member event is configured we use it; otherwise both go to the
 * one event and the template can branch on the (empty or populated) signup field.
 */
function resolveEventName(isClubMember: boolean): string | null {
  const base = getEventName()
  if (!base) return null

  if (!isClubMember) {
    const nonMemberEvent = process.env.INFORU_REVIEW_EVENT_NAME_NON_MEMBER?.trim()
    if (nonMemberEvent) return nonMemberEvent
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

    const fields = getFieldNames()

    try {
      const result = await triggerInforuAutomation({
        apiEventName: eventName,
        contacts: [
          {
            phoneNumber: phone ?? '',
            email: context.customerEmail ?? undefined,
            // Given name only, matching the greeting in our own email template.
            firstName: context.firstName || undefined,
            // Lets Inforu correlate the send back to our order.
            contactRefId: context.orderNumber,
            customFields: {
              [fields.reviewUrl]: context.reviewUrl,
              [fields.orderNumber]: context.orderNumber,
              // Empty for members, so a single template can branch on it.
              [fields.signupUrl]: context.isClubMember ? '' : context.signupUrl,
            },
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

      return { channel: 'inforu', ok: true, messageId: result.messageId }
    } catch (error) {
      return {
        channel: 'inforu',
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
}
