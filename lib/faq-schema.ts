/**
 * FAQPage JSON-LD, generated from the same records the accordions render.
 *
 * There is no hand-maintained copy of this schema anywhere — publishing,
 * editing, reordering, hiding and deleting all flow through the records, so the
 * structured data cannot drift from the visible page.
 *
 * Note on expectations: Google restricted FAQ rich results to government and
 * health sites in August 2023, so this markup will not produce SERP accordions
 * for a retailer. It is here because it is still the cleanest machine-readable
 * statement of "these are the questions and these are the answers" for AI
 * Overviews, ChatGPT/Perplexity extraction and Bing.
 *
 * Pure module — no Firestore, no React — so the "drafts never reach the schema"
 * rule is directly testable.
 */

export interface FaqSchemaItem {
  slug: string;
  /** Plain text. */
  question: string;
  /** Sanitized storage HTML. */
  answerHtml: string;
  /** Plain-text fallback used when the answer exceeds the length cap. */
  shortAnswer?: string;
}

/**
 * Google's documented allow-list for the `text` of an Answer. Anything outside
 * it is unwrapped to its text content rather than dropped, so no wording is
 * lost.
 */
const SCHEMA_ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'br', 'ol', 'ul', 'li', 'a', 'p', 'div',
  'b', 'strong', 'i', 'em',
]);

/**
 * Answers longer than this fall back to a summary. Google documents no hard
 * limit, but multi-kilobyte answers are truncated by consumers at unpredictable
 * points; a deliberate, coherent summary beats a sentence cut in half.
 */
const MAX_SCHEMA_ANSWER_LENGTH = 5000;

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Plain text of an HTML fragment, entities resolved and whitespace collapsed. */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  return decodeBasicEntities(
    html
      // Give block boundaries a space so "…end</p><p>Next…" doesn't fuse.
      .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Rewrite every <table> as a <ul>, one <li> per body row.
 *
 * Tables are not in schema.org/Google's allowed tag set, and stripping the tags
 * would fuse "35 5 22.5 36 6 23.0" into an unreadable run of digits — which
 * matters here because the sizing answers are exactly where a table is most
 * likely to be used. Header cells are paired with their column value so each
 * row stays self-describing out of context.
 */
export function tablesToLists(html: string): string {
  return html.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_match, tableInner: string) => {
    const rows = [...String(tableInner).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
    if (rows.length === 0) return '';

    const parseCells = (rowHtml: string) =>
      [...String(rowHtml).matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => ({
        isHeader: m[1].toLowerCase() === 'th',
        text: htmlToPlainText(m[2]),
      }));

    const parsed = rows.map(parseCells).filter((cells) => cells.length > 0);
    if (parsed.length === 0) return '';

    // A first row of all-<th> is the column header; use it to label the cells
    // of every later row.
    const first = parsed[0];
    const hasHeaderRow = first.every((cell) => cell.isHeader) && parsed.length > 1;
    const headers = hasHeaderRow ? first.map((cell) => cell.text) : [];
    const bodyRows = hasHeaderRow ? parsed.slice(1) : parsed;

    const items = bodyRows
      .map((cells) => {
        const parts = cells.map((cell, index) => {
          const label = headers[index];
          return label ? `${label}: ${cell.text}` : cell.text;
        });
        const line = parts.filter(Boolean).join(' — ');
        return line ? `<li>${escapeHtmlText(line)}</li>` : '';
      })
      .filter(Boolean);

    if (items.length === 0) return '';

    const caption = htmlToPlainText(
      (/<caption\b[^>]*>([\s\S]*?)<\/caption>/i.exec(String(tableInner)) ?? [])[1] ?? ''
    );

    return `${caption ? `<p>${escapeHtmlText(caption)}</p>` : ''}<ul>${items.join('')}</ul>`;
  });
}

/**
 * Reduce sanitized answer HTML to the subset schema consumers accept.
 *
 * HTML-preserving rather than flattened to plain text: the sizing and care
 * answers are step lists, and a numbered list survives extraction far better as
 * <ol><li> than as one long sentence. Relative hrefs are absolutized because a
 * consumer reading the JSON has no page context to resolve them against.
 */
export function faqAnswerToSchemaHtml(html: string, baseUrl: string): string {
  if (!html || !html.trim()) return '';

  const normalizedBase = baseUrl.replace(/\/$/, '');

  let result = tablesToLists(html);

  // Drop elements whose content is not text at all.
  result = result.replace(/<(script|style|iframe)\b[\s\S]*?<\/\1>/gi, '');
  result = result.replace(/<img\b[^>]*>/gi, '');

  result = result.replace(/<\/?([a-z0-9]+)\b([^>]*)>/gi, (match, rawTag: string, attrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!SCHEMA_ALLOWED_TAGS.has(tag)) return '';
    if (match.startsWith('</')) return `</${tag}>`;

    if (tag === 'a') {
      const href = (/\bhref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs) ?? [])
        .slice(2)
        .find((value) => typeof value === 'string');
      if (!href) return '<a>';
      const trimmed = href.trim();
      // Only http(s) and site-relative links survive; anything else (javascript:,
      // data:, mailto in an odd form) is not a citation target.
      if (/^https?:\/\//i.test(trimmed)) return `<a href="${escapeHtmlText(trimmed)}">`;
      if (trimmed.startsWith('/')) {
        return `<a href="${escapeHtmlText(`${normalizedBase}${trimmed}`)}">`;
      }
      return '<a>';
    }

    // Every other allowed tag keeps its name and loses all attributes.
    return `<${tag}>`;
  });

  return result.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
}

/**
 * The `text` for one Answer, with the over-length fallback applied.
 * Exported so a test can assert the fallback without reaching through the
 * whole schema builder.
 */
export function buildAnswerText(item: FaqSchemaItem, baseUrl: string): string {
  const full = faqAnswerToSchemaHtml(item.answerHtml, baseUrl);
  if (full.length <= MAX_SCHEMA_ANSWER_LENGTH) return full;

  const summary = (item.shortAnswer ?? '').trim();
  const paragraphs = [...full.matchAll(/<p>([\s\S]*?)<\/p>/gi)]
    .slice(0, 2)
    .map((m) => `<p>${m[1]}</p>`)
    .join('');

  const fallback = `${summary ? `<p>${escapeHtmlText(summary)}</p>` : ''}${paragraphs}`;
  if (fallback.trim()) return fallback.slice(0, MAX_SCHEMA_ANSWER_LENGTH);

  // No summary and no paragraphs to fall back to — hard-truncate as a last
  // resort rather than emitting a Question with no Answer.
  return full.slice(0, MAX_SCHEMA_ANSWER_LENGTH);
}

export interface BuildFaqSchemaOptions {
  locale: 'he' | 'en';
  /** Absolute canonical URL of the FAQ page for this locale. */
  pageUrl: string;
  /** Absolute site origin, used to resolve relative links inside answers. */
  baseUrl: string;
}

/**
 * Build the FAQPage object, or null when there is nothing to describe.
 *
 * Returning null rather than an empty `mainEntity` matters: an empty FAQPage is
 * a validation error in some consumers and says nothing useful in the rest.
 * The caller renders no <script> at all in that case.
 *
 * Callers must pass only published, locale-renderable items — see
 * selectRenderableFaqs in lib/faq-selectors.ts. That is the single gate.
 */
export function buildFaqPageStructuredData(
  items: readonly FaqSchemaItem[],
  options: BuildFaqSchemaOptions
): Record<string, unknown> | null {
  const entities = items
    .map((item) => {
      const name = htmlToPlainText(item.question);
      const text = buildAnswerText(item, options.baseUrl);
      if (!name || !text) return null;
      return {
        '@type': 'Question' as const,
        // Ties the schema entity to the on-page anchor, so a consumer can deep
        // link straight to the question it quoted.
        '@id': `${options.pageUrl}#faq-question-${item.slug}`,
        name,
        acceptedAnswer: {
          '@type': 'Answer' as const,
          text,
        },
      };
    })
    .filter((entity): entity is NonNullable<typeof entity> => entity !== null);

  if (entities.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${options.pageUrl}#faq`,
    mainEntityOfPage: options.pageUrl,
    inLanguage: options.locale === 'he' ? 'he-IL' : 'en-US',
    mainEntity: entities,
  };
}

/**
 * Serialize JSON-LD for injection into a <script> tag.
 *
 * JSON.stringify does not escape `<`, so an answer containing the literal text
 * "</script>" would close the tag early and turn the rest of the payload into
 * markup. Escaping every `<` to its \\u003c form is still valid JSON and parses
 * back to exactly the same string.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
