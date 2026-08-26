/**
 * /llms.txt — a Markdown index of the site for assistants that fetch one.
 *
 * Supplementary only. It does not replace indexable server-rendered HTML,
 * internal links, structured data or the XML sitemap, and not every AI crawler
 * reads it. Its job is to state, in one place, what this site is and which
 * pages answer which question.
 *
 * Pure builder so the "no draft or hidden question can appear here" rule is
 * unit-testable without Firestore.
 */

import type { FaqItem } from './faq-types';
import { selectPublishedFaqs, pickLocalized, type FaqLocale } from './faq-selectors';
import { sortFaqs } from './faq-order';

/** How many individual questions get their own deep link. */
const MAX_DEEP_LINKED_QUESTIONS = 10;

export interface LlmsTxtInput {
  /** All FAQ records; published ones are selected here, not by the caller. */
  faqs: readonly FaqItem[];
  /** Absolute site origin, no trailing slash. */
  baseUrl: string;
  /** Locales to advertise, in preference order (Hebrew first for this site). */
  locales: readonly FaqLocale[];
}

/** Escape the characters that would break a Markdown link label. */
function escapeMarkdownLabel(text: string): string {
  return text.replace(/([[\]])/g, '\\$1').replace(/\s+/g, ' ').trim();
}

function link(label: string, url: string, description: string): string {
  const suffix = description.trim() ? `: ${description.replace(/\s+/g, ' ').trim()}` : '';
  return `- [${escapeMarkdownLabel(label)}](${url})${suffix}`;
}

/**
 * Build the llms.txt body.
 *
 * Sections follow the llms.txt convention: an H1 with the site name, a
 * blockquote summary, then H2 groups of annotated links.
 */
export function buildLlmsTxt(input: LlmsTxtInput): string {
  const base = input.baseUrl.replace(/\/$/, '');
  const locales = input.locales.length > 0 ? input.locales : (['he'] as const);
  const primary = locales[0];

  const published = sortFaqs(selectPublishedFaqs(input.faqs));

  const lines: string[] = [];

  lines.push('# SAKO-OR');
  lines.push('');
  lines.push(
    '> SAKO-OR is an Israeli footwear and leather goods brand established in 1977, ' +
      'selling women\'s and men\'s shoes, bags and accessories online and from its physical store. ' +
      'Product pages carry per-style specifications including size fit, foot width, heel type and ' +
      'heel height. The site is served in Hebrew (default) and English.'
  );
  lines.push('');

  lines.push('## Shopping Guides and Customer Help');
  lines.push('');
  for (const locale of locales) {
    const label =
      locale === 'he'
        ? 'שאלות נפוצות ומדריך לבחירת נעליים'
        : 'Frequently Asked Questions and Shoe Buying Guide';
    const description =
      locale === 'he'
        ? 'מדריך של סכו עור למידות והתאמת נעליים, נעלי נשים וגברים, סוגי עקבים, חומרי גלם, טיפול בעור וזמש, משלוחים, החלפות והחזרות.'
        : "SAKO-OR guidance on shoe sizing and fit, women's and men's footwear, heel types, materials, leather and suede care, shipping, exchanges and returns.";
    lines.push(link(label, `${base}/${locale}/faq`, description));
  }
  lines.push('');

  if (published.length > 0) {
    lines.push(`### Individual questions (${primary})`);
    lines.push('');
    for (const item of published.slice(0, MAX_DEEP_LINKED_QUESTIONS)) {
      const question = pickLocalized(item.question, primary);
      if (!question) continue;
      const summary = pickLocalized(item.shortAnswer, primary);
      lines.push(link(question, `${base}/${primary}/faq#faq-question-${item.slug}`, summary));
    }
    lines.push('');
  }

  lines.push('## Collections');
  lines.push('');
  lines.push(
    link(
      'נעלי נשים / Women\'s shoes',
      `${base}/${primary}/collection/women`,
      "The full women's range — pumps, boots, sandals, loafers, sneakers and slippers."
    )
  );
  lines.push(
    link(
      'נעלי גברים / Men\'s shoes',
      `${base}/${primary}/collection/men`,
      "The full men's range, including formal shoes, loafers and casual styles."
    )
  );
  lines.push(link('All collections', `${base}/${primary}/collection`, 'Every category and subcategory.'));
  lines.push('');

  lines.push('## Product Guides');
  lines.push('');
  lines.push(
    link(
      'Bags guide',
      `${base}/${primary}/bags/guide`,
      'The whole bag range with full specifications — type, size, structure, strap and hardware — on one page.'
    )
  );
  lines.push('');

  lines.push('## News');
  lines.push('');
  lines.push(link('News and articles', `${base}/${primary}/news`, 'Brand news, styling and care articles.'));
  lines.push('');

  lines.push('## Policies and Contact');
  lines.push('');
  lines.push(link('Terms of service', `${base}/${primary}/terms`, 'Purchase terms and site conditions.'));
  lines.push(link('Privacy policy', `${base}/${primary}/privacy`, 'How customer data is handled.'));
  lines.push(link('Accessibility statement', `${base}/${primary}/accessibility`, 'Accessibility commitments and contact.'));
  lines.push(link('Contact', `${base}/${primary}/contact`, 'Customer service contact form and details.'));
  lines.push('');

  lines.push('## Optional');
  lines.push('');
  lines.push(link('XML sitemap', `${base}/sitemap.xml`, 'Every indexable URL with last-modified dates.'));
  lines.push('');

  return lines.join('\n');
}
