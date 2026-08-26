/**
 * FAQ domain types.
 *
 * Deliberately a standalone module rather than living in lib/firebase.ts: that
 * file calls initializeApp() at module scope, so anything importing it drags a
 * Firebase connection along. Keeping the types here lets the pure helpers
 * (lib/faq-*.ts) and their node:test suites import them for free. lib/firebase.ts
 * re-exports these, mirroring how lib/campaign-merchandising-types.ts is handled.
 */

/** Structurally identical to the LocalizedString in lib/firebase.ts. */
export interface FaqLocalizedString {
  he: string;
  en: string;
}

export const FAQ_COLLECTION = 'faqs';
export const FAQ_SETTINGS_COLLECTION = 'faqPageSettings';
export const FAQ_SETTINGS_DOC_ID = 'default';

export type FaqAudience = 'women' | 'men' | 'general';

/** Public section order on the page. Women first: it is the bulk of the catalog. */
export const FAQ_AUDIENCES: readonly FaqAudience[] = ['women', 'men', 'general'];

export type FaqStatus = 'draft' | 'published' | 'hidden';

export const FAQ_STATUSES: readonly FaqStatus[] = ['draft', 'published', 'hidden'];

export type FaqTopic =
  | 'sizing'
  | 'fit'
  | 'heels'
  | 'materials'
  | 'care'
  | 'occasion'
  | 'shipping'
  | 'returns'
  | 'payment'
  | 'store'
  | 'contact'
  | 'general';

export const FAQ_TOPICS: readonly FaqTopic[] = [
  'sizing',
  'fit',
  'heels',
  'materials',
  'care',
  'occasion',
  'shipping',
  'returns',
  'payment',
  'store',
  'contact',
  'general',
];

/** Bilingual admin labels for the audience/topic/status selects and public jump links. */
export const FAQ_AUDIENCE_LABELS: Record<FaqAudience, FaqLocalizedString> = {
  women: { he: 'נעלי נשים', en: "Women's Shoes" },
  men: { he: 'נעלי גברים', en: "Men's Shoes" },
  general: { he: 'שאלות כלליות', en: 'General Questions' },
};

export const FAQ_TOPIC_LABELS: Record<FaqTopic, FaqLocalizedString> = {
  sizing: { he: 'מידות', en: 'Sizes' },
  fit: { he: 'התאמה', en: 'Fit' },
  heels: { he: 'עקבים וסוגי נעליים', en: 'Heels & Shoe Types' },
  materials: { he: 'חומרי גלם', en: 'Materials' },
  care: { he: 'טיפול ותחזוקה', en: 'Shoe Care' },
  occasion: { he: 'אירועים והזדמנויות', en: 'Occasions' },
  shipping: { he: 'משלוחים', en: 'Shipping' },
  returns: { he: 'החלפות והחזרות', en: 'Exchanges & Returns' },
  payment: { he: 'תשלום', en: 'Payment' },
  store: { he: 'החנות והמלאי', en: 'Store & Availability' },
  contact: { he: 'שירות לקוחות', en: 'Customer Service' },
  general: { he: 'כללי', en: 'General' },
};

export const FAQ_STATUS_LABELS: Record<FaqStatus, FaqLocalizedString> = {
  draft: { he: 'טיוטה', en: 'Draft' },
  published: { he: 'פורסם', en: 'Published' },
  hidden: { he: 'מוסתר', en: 'Hidden' },
};

/** A crawlable internal link rendered at the end of an answer. */
export interface FaqRelatedLink {
  label: FaqLocalizedString;
  /** Locale-less internal path, e.g. "/collection/women". Rendered as `/${lng}${href}`. */
  href: string;
}

export interface FaqItem {
  id: string;
  /**
   * ASCII kebab, unique across the collection. Drives #faq-question-{slug} and
   * the JSON-LD @id, so it must stay stable once a question has been published —
   * changing it breaks every inbound deep link.
   */
  slug: string;
  audience: FaqAudience;
  topic: FaqTopic;
  /**
   * PLAIN TEXT, never HTML. It is rendered inside a <button> (where block
   * elements are invalid) and used verbatim as schema.org Question.name (which
   * must be text). The write routes strip any markup before storing.
   */
  question: FaqLocalizedString;
  /** Sanitized HTML. h3 is the deepest heading allowed — the page owns h1/h2. */
  answerHtml: FaqLocalizedString;
  /**
   * Optional one-or-two sentence plain-text summary. Rendered as the leading
   * callout and used as the JSON-LD text when the full answer exceeds the
   * schema length cap.
   */
  shortAnswer?: FaqLocalizedString;
  relatedLinks?: FaqRelatedLink[];
  /** Dense 0..n-1 within the audience group (all statuses, not just published). */
  order: number;
  status: FaqStatus;
  featured?: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Admin email, from AuthedRequestContext.email. */
  createdBy?: string;
  updatedBy?: string;
}

export interface FaqCta {
  label: FaqLocalizedString;
  /** Locale-less internal path, validated against INTERNAL_PATH_ALLOWLIST. */
  href: string;
}

export type FaqRobots = 'index, follow' | 'noindex, nofollow' | 'noindex, follow';

export interface FaqPageSettings {
  key: string;
  /** The page's single <h1>. */
  heading: FaqLocalizedString;
  /** Sanitized HTML intro paragraph(s) under the h1. */
  intro: FaqLocalizedString;
  sectionTitles: Record<FaqAudience, FaqLocalizedString>;
  seoTitle: FaqLocalizedString;
  seoDescription: FaqLocalizedString;
  ogTitle?: FaqLocalizedString;
  ogDescription?: FaqLocalizedString;
  ogImage?: string;
  robots: FaqRobots;
  /** Rendered at the bottom of the women's section. */
  primaryCta: FaqCta;
  /** Rendered at the bottom of the men's section. */
  secondaryCta?: FaqCta;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

/**
 * Fallback copy used when the settings doc has not been created yet, so the
 * public page is never blank and never renders an empty <h1>. An admin
 * overrides all of it from /admin/faq/settings.
 */
export const FAQ_SETTINGS_FALLBACK: Omit<FaqPageSettings, 'createdAt' | 'updatedAt' | 'key'> = {
  heading: {
    he: 'שאלות נפוצות ומדריך לבחירת נעליים',
    en: 'Frequently Asked Questions and Shoe Buying Guide',
  },
  intro: {
    he: '<p>כאן תמצאו תשובות לשאלות שאנחנו נשאלים הכי הרבה — איך בוחרים מידה, איך מודדים כף רגל בבית, מה ההבדל בין סוגי העקבים, אילו דגמים מתאימים לכף רגל רחבה, ואיך מטפלים בנעלי עור, זמש ולכה כך שיחזיקו שנים. בנוסף רוכזו כאן תשובות על משלוחים, החלפות והחזרות וזמינות דגמים.</p>',
    en: '<p>Answers to the questions we are asked most often — how to choose a size, how to measure your foot at home, the difference between heel types, which styles suit wider feet, and how to care for leather, suede and patent shoes so they last. Shipping, exchanges, returns and stock availability are covered here too.</p>',
  },
  sectionTitles: FAQ_AUDIENCE_LABELS,
  seoTitle: {
    he: 'שאלות נפוצות ומדריך לבחירת נעליים',
    en: 'FAQ and Shoe Buying Guide',
  },
  seoDescription: {
    he: 'תשובות לשאלות נפוצות על מידות, התאמה, סוגי נעליים, עקבים, חומרי גלם, טיפול בנעלי עור, משלוחים והחלפות בסכו עור.',
    en: 'Answers about shoe sizing, fit, shoe and heel types, materials, leather care, shipping and exchanges at SAKO-OR.',
  },
  robots: 'index, follow',
  primaryCta: {
    label: { he: 'לצפייה בקולקציית הנשים', en: "Shop the women's collection" },
    href: '/collection/women',
  },
  secondaryCta: {
    label: { he: 'לצפייה בקולקציית הגברים', en: "Shop the men's collection" },
    href: '/collection/men',
  },
};
