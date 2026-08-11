import 'server-only'
import { e164ToLocalPhone, triggerInforuAutomation } from '../inforu'
import type { InforuCustomFieldName } from '../inforu'

/**
 * Tells a customer their loyalty points were updated after a review.
 *
 * Points for reviewing are credited by hand in Verifone, so this notification is
 * triggered by the admin at the moment they record the award — there is nothing to
 * observe automatically.
 *
 * Delivery goes through an Inforu automation, exactly like the review request: the
 * message body lives in the Inforu console and pulls the before/after figures from
 * merge fields. The console decides whether it goes out as SMS or WhatsApp.
 *
 * Stays disabled until INFORU_POINTS_EVENT_NAME names an automation, so recording an
 * award still works before the console side exists — it is simply reported as
 * skipped rather than failing.
 */

export interface PointsNotificationResult {
  ok: boolean
  skipped?: boolean
  reason?: string
  messageId?: string
  error?: string
  /** Echoed back so the admin UI can show what the customer was told. */
  pointsBefore?: string
  pointsAfter?: string
}

/**
 * Merge-field slot for a points value.
 *
 * There is no safe default here. Inforu numbers custom fields per account, so the
 * correct slot is whatever that account's console maps — the review link, for
 * instance, lives in Text27, not Text1. Writing to an unmapped slot is silent:
 * Inforu answers `StatusId: 1` and the message goes out with the figure missing.
 *
 * So this returns null when unset, and the caller refuses to send rather than
 * deliver "your points went from  to ".
 */
function fieldName(envVar: string): InforuCustomFieldName | null {
  const value = process.env[envVar]?.trim()
  return value ? (value as InforuCustomFieldName) : null
}

/** Trims a Decimal-ish value to a human figure: 12.00 -> "12", 12.50 -> "12.5". */
export function formatPoints(value: number): string {
  return String(Math.round(value * 100) / 100)
}

export async function notifyPointsUpdated(params: {
  orderNumber: string
  customerName: string | null
  customerEmail: string | null
  /** E.164 as stored; converted to Inforu's local format here. */
  customerPhone: string | null
  pointsBefore: number
  pointsAfter: number
}): Promise<PointsNotificationResult> {
  const eventName = process.env.INFORU_POINTS_EVENT_NAME?.trim()

  const before = formatPoints(params.pointsBefore)
  const after = formatPoints(params.pointsAfter)

  if (!eventName) {
    return {
      ok: false,
      skipped: true,
      reason: 'INFORU_POINTS_EVENT_NAME is not configured',
      pointsBefore: before,
      pointsAfter: after,
    }
  }

  const phone = e164ToLocalPhone(params.customerPhone)

  if (!phone && !params.customerEmail) {
    return {
      ok: false,
      skipped: true,
      reason: 'No phone or email for this customer',
      pointsBefore: before,
      pointsAfter: after,
    }
  }

  // Refuse rather than send a message with blank figures. Both slots must be named
  // explicitly — see fieldName() for why guessing them is unsafe.
  const beforeField = fieldName('INFORU_POINTS_BEFORE_FIELD')
  const afterField = fieldName('INFORU_POINTS_AFTER_FIELD')

  if (!beforeField || !afterField) {
    return {
      ok: false,
      skipped: true,
      reason:
        'INFORU_POINTS_BEFORE_FIELD / INFORU_POINTS_AFTER_FIELD are not set — ' +
        'without the exact merge-field slots the customer would receive the message ' +
        'with the point figures missing',
      pointsBefore: before,
      pointsAfter: after,
    }
  }

  try {
    const result = await triggerInforuAutomation({
      apiEventName: eventName,
      contacts: [
        {
          phoneNumber: phone ?? '',
          email: params.customerEmail ?? undefined,
          firstName: params.customerName?.trim().split(/\s+/)[0] || undefined,
          contactRefId: params.orderNumber,
          customFields: {
            [beforeField]: before,
            [afterField]: after,
          },
        },
      ],
    })

    if (!result.success) {
      return {
        ok: false,
        error:
          typeof result.error === 'string' ? result.error : JSON.stringify(result.error),
        pointsBefore: before,
        pointsAfter: after,
      }
    }

    console.log('[POINTS_NOTIFY] Sent', {
      orderNumber: params.orderNumber,
      before,
      after,
    })

    return { ok: true, messageId: result.messageId, pointsBefore: before, pointsAfter: after }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      pointsBefore: before,
      pointsAfter: after,
    }
  }
}
