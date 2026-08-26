/**
 * Pure read-side helpers shared by the public page, the sitemap, llms.txt and
 * the admin list. Everything here is deliberately free of Firestore and React
 * so the "a draft must never reach the public" rule can be unit-tested directly.
 */

import type { FaqItem, FaqLocalizedString, FaqPageSettings, FaqStatus } from './faq-types';

export type FaqLocale = 'he' | 'en';

/**
 * Pick a locale off a bilingual field, falling back to the other language.
 *
 * The fallback is not cosmetic: English coverage of CMS content on this site is
 * fallback-based everywhere else (`page.title[locale] || page.title.en`), and a
 * question rendered as an empty <button> would be an accessibility failure and
 * an empty schema.org `name`. Falling back to Hebrew on /en is better than a
 * blank row.
 */
export function pickLocalized(
  field: FaqLocalizedString | undefined,
  locale: FaqLocale
): string {
  if (!field) return '';
  const primary = field[locale];
  if (primary && primary.trim()) return primary;
  const other = locale === 'he' ? field.en : field.he;
  return other && other.trim() ? other : '';
}

/**
 * The single gate between stored records and anything public.
 *
 * Every public surface (page HTML, JSON-LD, sitemap, llms.txt) must route
 * through this. `status === 'published'` is checked positively rather than
 * excluding 'draft', so a future status value is invisible by default instead
 * of leaking.
 */
export function isPubliclyVisible(item: Pick<FaqItem, 'status'>): boolean {
  return item.status === 'published';
}

/** Published items only, in a shape the page can render directly. */
export function selectPublishedFaqs<T extends { status: FaqStatus }>(items: readonly T[]): T[] {
  return items.filter((item) => isPubliclyVisible(item));
}

/**
 * Published items that actually have content in this locale.
 *
 * A record whose question is blank in both languages would render an empty
 * accordion row and an invalid schema.org Question, so it is dropped rather
 * than rendered broken.
 */
export function selectRenderableFaqs(items: readonly FaqItem[], locale: FaqLocale): FaqItem[] {
  return selectPublishedFaqs(items).filter(
    (item) => pickLocalized(item.question, locale).trim().length > 0
  );
}

/**
 * Normalize the many shapes a timestamp arrives in.
 *
 * Firestore's client SDK hands back Timestamp objects at runtime even where our
 * types say `string`, and `new Date(timestamp)` on one of those silently yields
 * an Invalid Date that only throws later, inside toISOString(). Same defensive
 * approach as toValidDate() in app/sitemap.ts.
 */
export function toFaqDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Truthful `lastmod` for the FAQ URL: the newest updatedAt across the published
 * questions and the settings doc.
 *
 * Draft and hidden items are excluded on purpose — editing a draft changes
 * nothing a crawler can see, and claiming otherwise trains Google to ignore our
 * lastmod values. Returns `fallback` only when there is nothing valid to read.
 */
export function getFaqLastModified(
  items: readonly FaqItem[],
  settings: Pick<FaqPageSettings, 'updatedAt'> | null | undefined,
  fallback: Date
): Date {
  const candidates: Date[] = [];

  for (const item of selectPublishedFaqs(items)) {
    const date = toFaqDate(item.updatedAt);
    if (date) candidates.push(date);
  }

  const settingsDate = toFaqDate(settings?.updatedAt);
  if (settingsDate) candidates.push(settingsDate);

  if (candidates.length === 0) return fallback;
  return candidates.reduce((latest, date) => (date > latest ? date : latest));
}

/** Case-insensitive substring match across both languages — the admin search box. */
export function faqMatchesSearch(
  item: Pick<FaqItem, 'question' | 'slug'> & { plainAnswer?: string },
  term: string
): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    item.question?.he ?? '',
    item.question?.en ?? '',
    item.slug ?? '',
    item.plainAnswer ?? '',
  ]
    .join(' \n ')
    .toLowerCase();
  return haystack.includes(needle);
}
