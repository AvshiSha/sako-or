/**
 * Slug generation for FAQ questions.
 *
 * A FAQ slug is load-bearing: it becomes #faq-question-{slug}, the JSON-LD @id,
 * and the deep links in llms.txt. It must therefore be ASCII (so it survives
 * being pasted into a chat or an email un-encoded), stable, and unique.
 *
 * Deliberately NOT reusing slugify() from lib/cms-utils.ts. That helper strips
 * every non-\w character, which turns a Hebrew-only string into '' — and an
 * empty slug would collapse every such question onto the same anchor id. Here
 * the English question is the slug source, with a deterministic fallback when
 * there is no usable ASCII at all.
 */

const MAX_SLUG_LENGTH = 60;

/**
 * Normalize a string into an ASCII kebab slug, or '' when nothing usable remains.
 *
 * NFKD splits an accented letter into base + combining mark, and \p{M} then
 * drops the mark, so "é" folds to "e" instead of being discarded. Scripts with
 * no ASCII equivalent at all (Hebrew, CJK, emoji) are removed.
 */
export function toFaqSlugCandidate(text: string): string {
  if (!text) return '';

  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    // Drop apostrophes rather than hyphenating them, so "women's" reads
    // "womens" and not "women-s".
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
}

/**
 * Build a slug from a question, preferring the English text.
 *
 * `fallbackIndex` produces `faq-{n}` for a question with no ASCII content at
 * all (a Hebrew-only entry). It is 1-based so the first such question reads
 * `faq-1` rather than `faq-0`.
 */
export function buildFaqSlug(
  question: { en?: string; he?: string },
  fallbackIndex = 1
): string {
  const fromEnglish = toFaqSlugCandidate(question.en ?? '');
  if (fromEnglish) return fromEnglish;

  // A Hebrew question can still contain ASCII worth keeping ("SAKO", sizes).
  const fromHebrew = toFaqSlugCandidate(question.he ?? '');
  if (fromHebrew) return fromHebrew;

  const n = Number.isInteger(fallbackIndex) && fallbackIndex > 0 ? fallbackIndex : 1;
  return `faq-${n}`;
}

/**
 * Suffix a slug until it no longer collides with `taken`.
 *
 * Idempotent for a slug that is already free, so re-saving a question without
 * renaming it never drifts to `-2`.
 */
export function ensureUniqueFaqSlug(slug: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(slug)) return slug;

  // Cap the base so the suffix can never push the slug past the length limit.
  const base = slug.slice(0, MAX_SLUG_LENGTH - 5).replace(/-+$/g, '') || 'faq';
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }

  // Practically unreachable; keeps the return type honest rather than looping.
  return `${base}-${Date.now()}`;
}

/** True when a slug is safe to use in a URL fragment and an HTML id. */
export function isValidFaqSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= MAX_SLUG_LENGTH;
}

/** The DOM id of a question's trigger button. */
export function faqQuestionElementId(slug: string): string {
  return `faq-question-${slug}`;
}

/** The DOM id of a question's answer panel. */
export function faqAnswerElementId(slug: string): string {
  return `faq-answer-${slug}`;
}

/**
 * Resolve a URL fragment to the FAQ slug it points at.
 *
 * Accepts the question id, the answer id, or a bare `#slug`, so a link shared
 * as either form opens the right question. Only the two explicit `faq-question-`
 * / `faq-answer-` prefixes are stripped — a bare `faq-3` is itself a legitimate
 * fallback slug, and eagerly stripping `faq-` would resolve it to `3`.
 */
export function slugFromHash(hash: string): string | null {
  let raw: string;
  try {
    raw = decodeURIComponent((hash || '').replace(/^#/, '')).trim();
  } catch {
    // A malformed percent-escape throws; treat it as "no anchor" rather than
    // taking down the whole page on mount.
    return null;
  }
  if (!raw) return null;

  const stripped = raw.replace(/^faq-(?:question|answer)-/, '');
  return isValidFaqSlug(stripped) ? stripped : null;
}
