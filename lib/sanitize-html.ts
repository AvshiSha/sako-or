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
  'img',
  'iframe',
  'br',
  'div',
  'table',
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
 * Sanitize CMS HTML for safe rendering on the storefront.
 * Uses sanitize-html (Node-safe) instead of jsdom-based DOMPurify for Vercel compatibility.
 */
export function sanitizeCmsHtml(html: string): string {
  const cleaned = cleanupCmsHtml(html)
  if (!cleaned) return ''

  return sanitizeHtmlLib(cleaned, {
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
      p: ['class'],
      h2: ['class'],
      h3: ['class'],
      ul: ['class'],
      ol: ['class'],
      li: ['class'],
      table: ['class'],
      thead: ['class'],
      tbody: ['class'],
      tfoot: ['class'],
      tr: ['class'],
      th: ['class', 'colspan', 'rowspan'],
      td: ['class', 'colspan', 'rowspan'],
      colgroup: ['class', 'span'],
      col: ['class', 'span', 'width'],
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
  })
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
