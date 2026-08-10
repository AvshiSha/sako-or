import 'server-only'

/**
 * Copy for the post-delivery review request, in Hebrew and English.
 *
 * Two variants per language, keyed on loyalty-club membership. Non-members are asked
 * to join *before* submitting, because points for the review are credited manually by
 * the team afterwards and that is only possible against a club account.
 */

export type ReviewLanguage = 'he' | 'en'

export interface ReviewMessageContext {
  firstName: string
  reviewUrl: string
  signupUrl: string
  isClubMember: boolean
}

export interface ReviewMessageCopy {
  subject: string
  greeting: string
  /** Paragraphs shown between the greeting and the call to action. */
  body: string[]
  ctaLabel: string
  /** Shown to non-members only, above the review CTA. */
  signupLabel: string | null
  signupNote: string | null
  closing: string
  /** Single-string rendering for SMS/WhatsApp, where there is no markup. */
  plainText: string
}

const HEBREW = {
  subject: 'נשמח לשמוע על החוויה שלך עם ההזמנה מסכו-עור 😊',
  greeting: (name: string) => `היי ${name},`,
  intro: 'נשמח לשמוע על החוויה שלך עם ההזמנה מסכו-עור 😊',
  why: 'כתיבת ביקורת קצרה עוזרת לנו להשתפר ועוזרת ללקוחות אחרים לבחור את המוצרים הנכונים.',
  memberNote: null,
  nonMemberNote:
    'אם עדיין אינך חברת מועדון הלקוחות, מומלץ להצטרף לפני שליחת הביקורת כדי שנוכל לזכות אותך בנקודות באופן ידני לאחר מכן.',
  signupLabel: 'להצטרפות למועדון הלקוחות',
  ctaLabel: 'לכתיבת הביקורת',
  closing: 'תודה שבחרת בסכו-עור ❤️',
}

const ENGLISH = {
  subject: 'We would love to hear about your Sako Or order 😊',
  greeting: (name: string) => `Hi ${name},`,
  intro: 'We would love to hear about your experience with your Sako Or order 😊',
  why: 'Writing a short review helps us improve and helps other customers choose the right products.',
  memberNote: null,
  nonMemberNote:
    'If you are not yet a loyalty club member, please register before submitting your review so we can manually add your loyalty points afterward.',
  signupLabel: 'Join the loyalty club',
  ctaLabel: 'Write your review',
  closing: 'Thank you for choosing Sako Or ❤️',
}

/** Fallback names, used when the order carries no customer name. */
const FALLBACK_NAME: Record<ReviewLanguage, string> = { he: 'לקוחה יקרה', en: 'there' }

export function buildReviewMessage(
  language: ReviewLanguage,
  context: ReviewMessageContext
): ReviewMessageCopy {
  const copy = language === 'he' ? HEBREW : ENGLISH
  const name = context.firstName.trim() || FALLBACK_NAME[language]

  const note = context.isClubMember ? copy.memberNote : copy.nonMemberNote

  const body = [copy.intro, copy.why]
  if (note) body.push(note)

  // SMS/WhatsApp rendering: no markup, links inline. Kept deliberately compact —
  // the Inforu template may impose its own length limits.
  const plainParts = [copy.greeting(name), '', copy.intro, '', copy.why]
  if (note) {
    plainParts.push('', note, '', `${copy.signupLabel}:`, context.signupUrl)
    plainParts.push('', `${copy.ctaLabel}:`, context.reviewUrl)
  } else {
    plainParts.push('', context.reviewUrl)
  }
  plainParts.push('', copy.closing)

  return {
    subject: copy.subject,
    greeting: copy.greeting(name),
    body,
    ctaLabel: copy.ctaLabel,
    signupLabel: context.isClubMember ? null : copy.signupLabel,
    signupNote: note,
    closing: copy.closing,
    plainText: plainParts.join('\n'),
  }
}

/**
 * Resolves the message language.
 *
 * Hebrew is the default: it is the primary market, and an English message to a Hebrew
 * speaker reads worse than the reverse.
 */
export function resolveReviewLanguage(
  userLanguage: string | null | undefined
): ReviewLanguage {
  return userLanguage?.trim().toLowerCase().startsWith('en') ? 'en' : 'he'
}
