/**
 * Strip empty / noisy HTML produced by ProseMirror/Tiptap before save and render.
 * Preserves intentional blank lines (empty <p>) between content paragraphs.
 * Safe for server (Vercel) — no jsdom.
 */

const EMPTY_BR = /(?:<br\s[^>]*\/?>|<br\s*\/?>)/gi

function innerText(html: string): string {
  return html
    .replace(EMPTY_BR, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u200B/g, '')
    .trim()
}

function isEmptyBlock(innerHtml: string): boolean {
  return innerText(innerHtml).length === 0
}

/** Empty <p> used for spacing — keep unless it sits next to a heading or doc edge. */
function shouldRemoveEmptyParagraph(before: string, after: string): boolean {
  const beforeTrimmed = before.trimEnd()
  const afterTrimmed = after.trimStart()

  if (!beforeTrimmed || !afterTrimmed) return true
  if (/<\/h[1-3]>\s*$/i.test(beforeTrimmed)) return true
  if (/^\s*<h[1-3]/i.test(afterTrimmed)) return true
  return false
}

/** Remove empty block tags and normalize br noise inside blocks. */
function removeEmptyBlocks(html: string): string {
  let result = html

  result = result.replace(/<br\s+class="ProseMirror-trailingBreak"\s*\/?>/gi, '')

  result = result.replace(
    /(<(?:p|h[1-3]|div)(?:\s[^>]*)?>)\s*(?:<br\s[^>]*\/?>|<br\s*\/?>\s*)+/gi,
    '$1'
  )
  result = result.replace(
    /(?:<br\s[^>]*\/?>|<br\s*\/?>\s*)+(<\/(?:p|h[1-3]|div)>)/gi,
    '$1'
  )

  result = result.replace(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi, (match, inner, offset) => {
    if (!isEmptyBlock(inner)) return match
    const before = result.slice(0, offset)
    const after = result.slice(offset + match.length)
    return shouldRemoveEmptyParagraph(before, after) ? '' : match
  })

  result = result.replace(/<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/gi, (match, inner) =>
    isEmptyBlock(inner) ? '' : match
  )
  result = result.replace(/<h2(?:\s[^>]*)?>([\s\S]*?)<\/h2>/gi, (match, inner) =>
    isEmptyBlock(inner) ? '' : match
  )
  result = result.replace(/<h3(?:\s[^>]*)?>([\s\S]*?)<\/h3>/gi, (match, inner) =>
    isEmptyBlock(inner) ? '' : match
  )
  result = result.replace(/<div(?:\s[^>]*)?>([\s\S]*?)<\/div>/gi, (match, inner) => {
    if (/youtube-embed|data-youtube-video|<iframe/i.test(inner)) return match
    return isEmptyBlock(inner) ? '' : match
  })

  return result
}

/** Unwrap sole <p> inside <li> so lists don't add extra vertical gap. */
function unwrapListItemParagraphs(html: string): string {
  return html.replace(
    /<li(\s[^>]*)?>\s*<p(\s[^>]*)?>([\s\S]*?)<\/p>\s*<\/li>/gi,
    (_match, liAttrs, _pAttrs, inner) => {
      if (/<\/p>/i.test(inner)) return _match
      return `<li${liAttrs || ''}>${inner.trim()}</li>`
    }
  )
}

function removeEmptyListItems(html: string): string {
  let result = html
  result = result.replace(/<li(\s[^>]*)?>([\s\S]*?)<\/li>/gi, (match, _attrs, inner) =>
    isEmptyBlock(inner) ? '' : match
  )
  result = result.replace(/<(ul|ol)(\s[^>]*)?>\s*<\/\1>/gi, '')
  return result
}

/**
 * Clean CMS HTML for storage and display.
 */
export function cleanupCmsHtml(html: string): string {
  if (!html?.trim()) return ''

  let result = html.trim()

  for (let i = 0; i < 6; i++) {
    const before = result
    result = removeEmptyBlocks(result)
    result = unwrapListItemParagraphs(result)
    result = removeEmptyListItems(result)
    if (result === before) break
  }

  return result.trim()
}

/** Extract visible text from CMS HTML (for slugs, meta titles, alt text). */
export function cmsHtmlToPlainText(html: string): string {
  return innerText(html)
}

/** Convert stored inline field (plain text or HTML) into editor-safe HTML. */
export function normalizeInlineFieldHtml(value: string): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return ''
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return cleanupCmsHtml(trimmed)
  const escaped = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<p>${escaped}</p>`
}

/** True when editor/content field has no meaningful text (ignores spacing-only empty paragraphs). */
export function isCmsHtmlEmpty(html: string): boolean {
  return innerText(html).length === 0
}
