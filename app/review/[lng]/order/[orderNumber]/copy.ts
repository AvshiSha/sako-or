/**
 * Review page copy, Hebrew and English.
 *
 * Kept in its own module so the server page and the client form share one source of
 * wording, following the inline-translations pattern used elsewhere in `app/[lng]`.
 */
export const reviewPageCopy = {
  he: {
    // Failure / terminal states
    invalidTitle: 'הקישור אינו תקין',
    invalidBody:
      'ייתכן שהקישור פג תוקף או שאינו נכון. אם קיבלת אותו מאיתנו לאחרונה, נשמח שתיצרי איתנו קשר.',
    alreadyTitle: 'כבר קיבלנו את הביקורת שלך',
    alreadyBody: 'תודה רבה! הביקורת שלך נשמרה ואנחנו מעריכים את הזמן שהקדשת.',

    // Form
    title: 'איך היתה החוויה שלך?',
    intro: 'נשמח לשמוע על ההזמנה שלך. זה לוקח פחות מדקה.',
    orderLabel: 'הזמנה',
    overallLabel: 'איך היתה חוויית הקנייה באופן כללי?',
    productsHeading: 'המוצרים שהזמנת',
    productRatingLabel: 'איך המוצר?',
    reviewBodyLabel: 'מה דעתך על המוצר?',
    reviewBodyPlaceholder: 'מה אהבת? מה פחות?',
    sizingLabel: 'איך המידה?',
    sizingOptions: {
      runs_small: 'קטן מהמידה',
      true_to_size: 'מדויק',
      runs_large: 'גדול מהמידה',
    },

    moreHeading: 'השירות והמשלוח',
    moreIntro: 'לא חובה, אבל זה מאוד עוזר לנו.',
    serviceRatingLabel: 'איך היה השירות שלנו?',
    serviceLabel: 'הערות על השירות',
    deliveryRatingLabel: 'איך היה המשלוח?',
    deliveryLabel: 'הערות על המשלוח',
    packagingRatingLabel: 'איך הגיעו המוצרים אליך?',
    packagingHint: 'האריזה ומצב המוצרים כשהגיעו',
    packagingLabel: 'הערות על איך שהמוצרים היו ארוזים והגיעו',

    generalHeading: 'עוד משהו?',
    generalLabel: 'יש עוד משהו שתרצי לספר לנו?',
    generalPlaceholder: 'כל דבר — רעיון, מחמאה, או משהו שאפשר לשפר',
    optional: 'לא חובה',
    submit: 'שליחת הביקורת',
    submitting: 'שולח…',

    // Ratings
    ratingWords: ['', 'לא מרוצה', 'ככה ככה', 'בסדר', 'טוב מאוד', 'מצוין'],
    starLabel: (n: number) => `${n} מתוך 5 כוכבים`,

    // Progress + validation
    progress: (done: number, total: number) => `${done} מתוך ${total} מוצרים דורגו`,
    errorSummaryTitle: 'כמעט סיימנו — חסרים כמה דירוגים:',
    errorOverall: 'נא לדרג את חוויית הקנייה',
    errorProduct: (name: string) => `נא לדרג את ${name}`,
    errorGeneric: 'לא הצלחנו לשמור את הביקורת. אנא נסי שוב.',
    charsLeft: (n: number) => `נותרו ${n} תווים`,

    // Success
    successTitle: 'תודה רבה!',
    successBody: 'הביקורת שלך נשמרה, והיא עוזרת לנו וללקוחות אחרות לבחור נכון.',
    googleCta: 'לכתוב ביקורת גם בגוגל',
    googleNote: 'אם בא לך, נשמח גם לביקורת בגוגל — זה עוזר לנו מאוד.',

    size: 'מידה',
    color: 'צבע',
  },

  en: {
    invalidTitle: 'This link is not valid',
    invalidBody:
      'It may have expired or been mistyped. If we sent it to you recently, please get in touch.',
    alreadyTitle: 'We already have your review',
    alreadyBody: 'Thank you! Your review was saved and we appreciate the time you took.',

    title: 'How was your experience?',
    intro: 'We would love to hear about your order. It takes less than a minute.',
    orderLabel: 'Order',
    overallLabel: 'How was your shopping experience overall?',
    productsHeading: 'What you ordered',
    productRatingLabel: 'How is this product?',
    reviewBodyLabel: 'What did you think?',
    reviewBodyPlaceholder: 'What did you like? What was less good?',
    sizingLabel: 'How is the fit?',
    sizingOptions: {
      runs_small: 'Runs small',
      true_to_size: 'True to size',
      runs_large: 'Runs large',
    },

    moreHeading: 'Service and delivery',
    moreIntro: 'Optional, but it really helps us.',
    serviceRatingLabel: 'How was our service?',
    serviceLabel: 'Comments about our service',
    deliveryRatingLabel: 'How was the delivery?',
    deliveryLabel: 'Comments about delivery',
    packagingRatingLabel: 'How did the products reach you?',
    packagingHint: 'The packaging and the condition they arrived in',
    packagingLabel: 'Comments on how the products were packed and arrived',

    generalHeading: 'Anything else?',
    generalLabel: 'Is there anything else you would like to tell us?',
    generalPlaceholder: 'Anything at all — an idea, a compliment, or something we could do better',
    optional: 'optional',
    submit: 'Submit review',
    submitting: 'Sending…',

    ratingWords: ['', 'Poor', 'Not great', 'Okay', 'Very good', 'Excellent'],
    starLabel: (n: number) => `${n} out of 5 stars`,

    progress: (done: number, total: number) => `${done} of ${total} products rated`,
    errorSummaryTitle: 'Almost done — a few ratings are missing:',
    errorOverall: 'Please rate your shopping experience',
    errorProduct: (name: string) => `Please rate ${name}`,
    errorGeneric: 'We could not save your review. Please try again.',
    charsLeft: (n: number) => `${n} characters left`,

    successTitle: 'Thank you!',
    successBody: 'Your review has been saved, and it helps us and other shoppers choose well.',
    googleCta: 'Also review us on Google',
    googleNote: 'If you feel like it, a Google review helps us a lot.',

    size: 'Size',
    color: 'Color',
  },
} as const

export type ReviewLang = keyof typeof reviewPageCopy
