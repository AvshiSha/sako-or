import sanitizeHtmlLib from 'sanitize-html'
import { cleanupCmsHtml } from './cms-html-cleanup'

const ALLOWED_TAGS = [
  'p',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'a',
  'strong',
  'em',
  'u',
  'blockquote',
  'hr',
  'img',
  'iframe',
  'br',
  'div',
  'table',
  // <caption> names a table for screen-reader users, who otherwise meet the
  // table with no context. Required for the FAQ sizing tables and harmless for
  // the rest of the CMS content.
  'caption',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'colgroup',
  'col',
]

/**
 * Shared sanitizer configuration.
 *
 * Extracted to a constant so variants (see sanitizeFaqAnswerHtml) can start
 * from exactly the same allow-lists and override only what differs, instead of
 * copying the config and drifting from it.
 */
const CMS_SANITIZE_OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title', 'class'],
    img: ['src', 'alt', 'title', 'loading', 'width', 'height', 'class'],
    iframe: [
      'src',
      'loading',
      'allowfullscreen',
      'allow',
      'frameborder',
      'class',
      'width',
      'height',
    ],
    div: ['class', 'data-youtube-video'],
    p: ['class', 'style'],
    h2: ['class', 'style'],
    h3: ['class', 'style'],
    ul: ['class'],
    ol: ['class'],
    li: ['class'],
    blockquote: ['class'],
    table: ['class'],
    caption: ['class'],
    thead: ['class'],
    tbody: ['class'],
    tfoot: ['class'],
    tr: ['class'],
    // `scope` is what tells a screen reader whether a header cell labels its
    // column or its row; without it a data table is read as an undifferentiated
    // grid of numbers.
    th: ['class', 'colspan', 'rowspan', 'scope'],
    td: ['class', 'colspan', 'rowspan'],
    colgroup: ['class', 'span'],
    col: ['class', 'span', 'width'],
  },
  // Restricted to exactly the inline style TipTap's TextAlign extension
  // emits (style="text-align: left|center|right"), so `style` isn't opened
  // up as a general CSS-injection vector.
  allowedStyles: {
    '*': {
      'text-align': [/^left$/, /^center$/, /^right$/],
    },
  },
  allowedIframeHostnames: [
    'www.youtube.com',
    'youtube.com',
    'www.youtube-nocookie.com',
    'youtube-nocookie.com',
  ],
  transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href || ''
        if (href.startsWith('http://') || href.startsWith('https://')) {
          return {
            tagName,
            attribs: {
              ...attribs,
              target: '_blank',
              rel: 'noopener noreferrer',
            },
          }
        }
        return { tagName, attribs }
      },
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          loading: attribs.loading || 'lazy',
        },
      }),
    iframe: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        loading: attribs.loading || 'lazy',
        allowfullscreen: 'true',
      },
    }),
  },
}

/**
 * Sanitize CMS HTML for safe rendering on the storefront.
 * Uses sanitize-html (Node-safe) instead of jsdom-based DOMPurify for Vercel compatibility.
 */
export function sanitizeCmsHtml(html: string): string {
  const cleaned = cleanupCmsHtml(html)
  if (!cleaned) return ''

  return sanitizeHtmlLib(cleaned, CMS_SANITIZE_OPTIONS)
}

/**
 * The one class token an FAQ answer may carry — the highlighted summary box.
 * Whitelisted rather than allowing arbitrary classes, which would let an admin
 * apply any utility class on the page to their answer.
 */
export const FAQ_CALLOUT_CLASS = 'faq-callout'

/**
 * FAQ answers are rendered inside an accordion panel whose question is already
 * an <h2>, and the page owns the single <h1>. A heading above h3 inside an
 * answer would therefore break the document outline.
 *
 * They are DEMOTED to h3 rather than rejected. The FAQ editor's toolbar only
 * offers H3, so an h1/h2 can realistically only arrive by pasting from Word or
 * another site; silently deleting a pasted heading loses the author's text,
 * while refusing the save is hostile for something the author did not choose to
 * do. Demotion keeps both the wording and the outline invariant, and the write
 * routes surface a non-blocking warning so it is visible rather than silent.
 */
const FAQ_SANITIZE_OPTIONS: sanitizeHtmlLib.IOptions = {
  ...CMS_SANITIZE_OPTIONS,
  // No iframe: a YouTube embed inside a collapsed panel costs third-party JS and
  // a layout-shift risk on a page that otherwise needs neither.
  allowedTags: ALLOWED_TAGS.filter((tag) => tag !== 'iframe'),
  allowedIframeHostnames: [],
  // '*' rather than per-tag: the shared config allows a `class` attribute on
  // almost every tag, so listing only blockquote/div would leave every other
  // element free to carry any class on the page.
  allowedClasses: {
    '*': [FAQ_CALLOUT_CLASS],
  },
  transformTags: {
    ...CMS_SANITIZE_OPTIONS.transformTags,
    h1: 'h3',
    h2: 'h3',
  },
}

export function sanitizeFaqAnswerHtml(html: string): string {
  const cleaned = cleanupCmsHtml(html)
  if (!cleaned) return ''

  return sanitizeHtmlLib(cleaned, FAQ_SANITIZE_OPTIONS)
}

/**
 * True when the input contains a heading that sanitizeFaqAnswerHtml will demote.
 * Used to tell the admin what happened to their paste, not to block the save.
 */
export function faqAnswerHadDemotedHeadings(html: string): boolean {
  return /<h[12]\b/i.test(html || '')
}

const INLINE_ALLOWED_TAGS = ['p', 'a', 'strong', 'em', 'br']

function transformAnchorTag(tagName: string, attribs: Record<string, string>) {
  const href = attribs.href || ''
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return {
      tagName,
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'noopener noreferrer',
        class: attribs.class || 'text-[#856D55] underline',
      },
    }
  }
  return {
    tagName,
    attribs: {
      ...attribs,
      class: attribs.class || 'text-[#856D55] underline',
    },
  }
}

/** Sanitize inline title HTML — links and basic emphasis only. */
export function sanitizeInlineHtml(html: string): string {
  const cleaned = cleanupCmsHtml(html)
  if (!cleaned) return ''

  return sanitizeHtmlLib(cleaned, {
    allowedTags: INLINE_ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'title', 'class'],
      p: ['class'],
      strong: ['class'],
      em: ['class'],
    },
    transformTags: {
      a: transformAnchorTag,
    },
  })
}

/** Remove block wrapper so inline HTML can live inside h1/h2. */
export function stripInlineBlockWrapper(html: string): string {
  let result = sanitizeInlineHtml(html).trim()
  for (let i = 0; i < 3; i++) {
    const unwrapped = result.replace(/^<p(?:\s[^>]*)?>([\s\S]*)<\/p>$/i, '$1').trim()
    if (unwrapped === result) break
    result = unwrapped
  }
  return result
}
