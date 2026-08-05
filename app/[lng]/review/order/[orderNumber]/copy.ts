/**
 * Review page copy. Kept in its own module so the server page and the client form
 * share one source of wording, following the inline-translations pattern used by the
 * other `app/[lng]` pages.
 */
export const reviewPageCopy = {
  he: {
    invalidTitle: 'הקישור אינו תקין',
    invalidBody:
      'ייתכן שהקישור פג תוקף או שאינו נכון. אם קיבלת אותו מאיתנו לאחרונה, נשמח אם תיצרי איתנו קשר.',
    alreadyTitle: 'כבר קיבלנו את הביקורת שלך 🙏',
    alreadyBody: 'תודה רבה! הביקורת שלך נשמרה ואנחנו מעריכים את הזמן שהקדשת.',

    title: 'איך היתה החוויה שלך?',
    intro: 'נשמח לשמוע על ההזמנה שלך. זה לוקח פחות מדקה.',
    overallLabel: 'דירוג חוויית הקנייה הכללית',
    productsHeading: 'המוצרים שהזמנת',
    productRatingLabel: 'דירוג המוצר',
    reviewTitleLabel: 'כותרת (אופציונלי)',
    reviewBodyLabel: 'מה דעתך על המוצר? (אופציונלי)',
    sizingLabel: 'איך המידה?',
    sizingOptions: {
      runs_small: 'קטן מהמידה',
      true_to_size: 'מדויק במידה',
      runs_large: 'גדול מהמידה',
    },
    serviceLabel: 'הערות על השירות (אופציונלי)',
    deliveryLabel: 'הערות על המשלוח (אופציונלי)',
    submit: 'שליחת הביקורת',
    submitting: 'שולח…',
    requiredError: 'נא לבחור דירוג כללי ודירוג לכל מוצר.',
    successTitle: 'תודה רבה! 🙏',
    successBody: 'הביקורת שלך נשמרה ועוזרת לנו ולקונות אחרות.',
    googleCta: 'לכתיבת ביקורת גם בגוגל',
    googleNote: 'אם בא לך, נשמח גם לביקורת בגוגל — זה עוזר לנו מאוד.',
    size: 'מידה',
    color: 'צבע',
  },
  en: {
    invalidTitle: 'This link is not valid',
    invalidBody:
      'It may have expired or been mistyped. If we sent it to you recently, please get in touch.',
    alreadyTitle: 'We already have your review 🙏',
    alreadyBody: 'Thank you! Your review was saved and we appreciate the time you took.',

    title: 'How was your experience?',
    intro: 'We would love to hear about your order. It takes less than a minute.',
    overallLabel: 'Overall shopping experience',
    productsHeading: 'What you ordered',
    productRatingLabel: 'Product rating',
    reviewTitleLabel: 'Title (optional)',
    reviewBodyLabel: 'What did you think of this product? (optional)',
    sizingLabel: 'How was the fit?',
    sizingOptions: {
      runs_small: 'Runs small',
      true_to_size: 'True to size',
      runs_large: 'Runs large',
    },
    serviceLabel: 'Comments about our service (optional)',
    deliveryLabel: 'Comments about delivery (optional)',
    submit: 'Submit review',
    submitting: 'Sending…',
    requiredError: 'Please choose an overall rating and a rating for each product.',
    successTitle: 'Thank you! 🙏',
    successBody: 'Your review has been saved and helps us and other shoppers.',
    googleCta: 'Also review us on Google',
    googleNote: 'If you feel like it, a Google review helps us a lot.',
    size: 'Size',
    color: 'Color',
  },
} as const

export type ReviewPageCopy = (typeof reviewPageCopy)['he']
