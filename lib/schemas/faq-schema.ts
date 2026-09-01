/**
 * Zod schemas for the FAQ admin API.
 *
 * Single source of validation for the route handlers, the admin forms and the
 * seed script, so client-side checks can never be more permissive than what the
 * server enforces. Follows the shape of lib/schemas/product-schema.ts, including
 * its zodErrorsToFieldMap bridge for surfacing issues next to form fields.
 */

import { z } from 'zod';
import { FAQ_AUDIENCES, FAQ_STATUSES, FAQ_TOPICS } from '../faq-types';
import type { FaqAudience, FaqStatus, FaqTopic } from '../faq-types';

/**
 * The cast preserves the literal union (z.enum needs a non-empty tuple, and a
 * `readonly T[]` is not one) so `z.infer` still yields FaqAudience rather than
 * widening to string. Same intent as enumFromOptions in product-schema.ts.
 */
const tuple = <T extends string>(values: readonly T[]) => values as unknown as [T, ...T[]];

export const faqAudienceSchema = z.enum(tuple<FaqAudience>(FAQ_AUDIENCES));
export const faqStatusSchema = z.enum(tuple<FaqStatus>(FAQ_STATUSES));
export const faqTopicSchema = z.enum(tuple<FaqTopic>(FAQ_TOPICS));

export const faqRobotsSchema = z.enum(['index, follow', 'noindex, follow', 'noindex, nofollow']);

/**
 * Internal paths a CTA or related link may point at.
 *
 * An allowlist rather than a shape regex alone. A regex that only checks
 * "starts with / and has no colon" happily accepts /colection/wemen — a
 * perfectly safe URL that is also a 404, which is exactly the failure a CTA
 * validator exists to prevent. The route set on this site is small and static,
 * so enumerating it costs nothing and catches typos at save time.
 *
 * Locale-less: the page renders `/${lng}${href}`.
 */
export const INTERNAL_PATH_ALLOWLIST = [
  '',
  '/collection',
  '/collection/women',
  '/collection/men',
  '/contact',
  '/about',
  '/news',
  '/bags/guide',
  '/terms',
  '/policies',
  '/shipping-and-returns',
  '/privacy',
  '/accessibility',
  '/faq',
] as const;

/**
 * Paths under which any deeper path is also allowed, so a CTA can point at a
 * specific sub-collection (/collection/women/shoes/boots) or article without
 * every one being enumerated here.
 */
const ALLOWED_PATH_PREFIXES = ['/collection/', '/news/'] as const;

export interface InternalPathCheck {
  valid: boolean;
  reason?: string;
}

/** Shared by the zod refinement and the admin form's inline validation. */
export function checkInternalPath(value: string): InternalPathCheck {
  const raw = (value ?? '').trim();

  if (raw === '') return { valid: true };

  if (!raw.startsWith('/')) {
    return { valid: false, reason: 'Must be an internal path starting with "/"' };
  }
  // "//evil.com" is a protocol-relative URL — it leaves the site despite
  // starting with a slash.
  if (raw.startsWith('//')) {
    return { valid: false, reason: 'Protocol-relative URLs are not allowed' };
  }
  if (raw.includes(':')) {
    return { valid: false, reason: 'Absolute URLs and schemes are not allowed' };
  }
  if (raw.includes('..')) {
    return { valid: false, reason: 'Path traversal is not allowed' };
  }
  if (/\s/.test(raw)) {
    return { valid: false, reason: 'Path must not contain whitespace' };
  }
  // A locale prefix is added at render time; including one here would produce
  // /he/he/faq.
  if (/^\/(he|en)(\/|$)/.test(raw)) {
    return { valid: false, reason: 'Omit the language prefix — it is added automatically' };
  }

  // Compare on the path only; a hash (deep link to a question) or query string
  // is legitimate and must not defeat the allowlist match.
  const pathOnly = raw.split(/[?#]/)[0].replace(/\/$/, '');

  if ((INTERNAL_PATH_ALLOWLIST as readonly string[]).includes(pathOnly)) {
    return { valid: true };
  }
  if (ALLOWED_PATH_PREFIXES.some((prefix) => pathOnly.startsWith(prefix) && pathOnly.length > prefix.length)) {
    return { valid: true };
  }

  return { valid: false, reason: `"${pathOnly}" is not a known page on this site` };
}

export const internalPathSchema = z
  .string()
  .max(200)
  .refine((value) => checkInternalPath(value).valid, (value) => ({
    message: checkInternalPath(value).reason ?? 'Invalid internal path',
  }));

/**
 * A bilingual field. Both keys are always present (empty string when unset) so
 * a partial update can never leave a half-written LocalizedString in Firestore.
 */
const localizedStringSchema = z.object({
  he: z.string().max(20000).default(''),
  en: z.string().max(20000).default(''),
});

/** A question must be answerable in at least one language to be worth storing. */
const requireOneLanguage = (field: { he: string; en: string }) =>
  field.he.trim().length > 0 || field.en.trim().length > 0;

export const faqQuestionTextSchema = z
  .object({
    he: z.string().max(300).default(''),
    en: z.string().max(300).default(''),
  })
  .refine(requireOneLanguage, {
    message: 'A question is required in at least one language',
  });

export const faqAnswerSchema = localizedStringSchema.refine(requireOneLanguage, {
  message: 'An answer is required in at least one language',
});

export const faqRelatedLinkSchema = z.object({
  label: z.object({
    he: z.string().max(120).default(''),
    en: z.string().max(120).default(''),
  }),
  href: internalPathSchema,
});

export const faqSlugSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must be lowercase letters, digits and single hyphens'
  );

export const createFaqSchema = z.object({
  slug: faqSlugSchema.optional(),
  audience: faqAudienceSchema,
  topic: faqTopicSchema.default('general'),
  question: faqQuestionTextSchema,
  answerHtml: faqAnswerSchema,
  shortAnswer: z
    .object({
      he: z.string().max(400).default(''),
      en: z.string().max(400).default(''),
    })
    .optional(),
  relatedLinks: z.array(faqRelatedLinkSchema).max(6).optional(),
  // 'hidden' is meaningless for something that has never been published, so
  // creation is limited to the two states that can actually apply.
  status: z.enum(['draft', 'published']).default('draft'),
  featured: z.boolean().optional(),
});

/**
 * Every field optional — PATCH semantics. `order` is deliberately absent:
 * ordering only ever changes through the reorder route, which validates group
 * membership. Letting an edit set it directly would let one save silently
 * duplicate another question's position.
 */
export const updateFaqSchema = z
  .object({
    slug: faqSlugSchema.optional(),
    audience: faqAudienceSchema.optional(),
    topic: faqTopicSchema.optional(),
    question: faqQuestionTextSchema.optional(),
    answerHtml: faqAnswerSchema.optional(),
    shortAnswer: z
      .object({
        he: z.string().max(400).default(''),
        en: z.string().max(400).default(''),
      })
      .optional(),
    relatedLinks: z.array(faqRelatedLinkSchema).max(6).optional(),
    status: faqStatusSchema.optional(),
    featured: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'No fields to update',
  });

export const updateFaqStatusSchema = z.object({
  status: faqStatusSchema,
});

export const reorderFaqSchema = z.object({
  audience: faqAudienceSchema,
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});

export const faqCtaSchema = z.object({
  label: z.object({
    he: z.string().max(120).default(''),
    en: z.string().max(120).default(''),
  }),
  href: internalPathSchema,
});

export const faqSettingsSchema = z.object({
  heading: localizedStringSchema.refine(requireOneLanguage, {
    message: 'A page heading is required in at least one language',
  }),
  intro: localizedStringSchema,
  sectionTitles: z.object({
    women: localizedStringSchema,
    men: localizedStringSchema,
    general: localizedStringSchema,
  }),
  seoTitle: z.object({
    he: z.string().max(120).default(''),
    en: z.string().max(120).default(''),
  }),
  seoDescription: z.object({
    he: z.string().max(320).default(''),
    en: z.string().max(320).default(''),
  }),
  ogTitle: z
    .object({ he: z.string().max(120).default(''), en: z.string().max(120).default('') })
    .optional(),
  ogDescription: z
    .object({ he: z.string().max(320).default(''), en: z.string().max(320).default('') })
    .optional(),
  ogImage: z.string().max(500).optional(),
  robots: faqRobotsSchema.default('index, follow'),
  primaryCta: faqCtaSchema,
  secondaryCta: faqCtaSchema.optional(),
});

export const faqPreviewSchema = z.object({
  question: z.string().max(300).default(''),
  answerHtml: z.string().max(20000).default(''),
});

export type CreateFaqInput = z.infer<typeof createFaqSchema>;
export type UpdateFaqInput = z.infer<typeof updateFaqSchema>;
export type FaqSettingsInput = z.infer<typeof faqSettingsSchema>;
export type ReorderFaqInput = z.infer<typeof reorderFaqSchema>;
