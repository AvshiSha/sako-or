/**
 * Presentation-level HTML post-processing for FAQ answers.
 *
 * Runs after sanitization, on the server, purely to add markup the sanitizer
 * has no business inventing. Pure and dependency-free so it can be unit-tested.
 */

/**
 * Wrap every <table> in a horizontally scrollable, keyboard-reachable region.
 *
 * The editor gets this for free — TipTap wraps tables in `.tableWrapper`, which
 * globals.css gives `overflow-x: auto`. Sanitized storefront HTML has no such
 * wrapper, so a size-conversion table wider than a phone would push the whole
 * page sideways. Wrapping is done here rather than by allowing the class through
 * the sanitizer, because that would depend on an admin's markup being right.
 *
 * `tabindex="0"` is not decorative: a region that scrolls must be reachable by
 * keyboard, or a keyboard-only user cannot see the columns that overflow
 * (WCAG 2.1.1). `role="region"` plus a label is what makes that stop announce
 * itself as something meaningful rather than an unlabelled tab stop.
 *
 * The <table> element itself is untouched, so caption/thead/th[scope] semantics
 * survive intact.
 */
export function wrapFaqTables(html: string, label: string): string {
  if (!html || !html.includes('<table')) return html;

  const escapedLabel = label
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return html.replace(
    /<table\b[\s\S]*?<\/table>/gi,
    (table) =>
      `<div class="faq-table-scroll" role="region" tabindex="0" aria-label="${escapedLabel}">${table}</div>`
  );
}
