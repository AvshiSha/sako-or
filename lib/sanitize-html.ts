import sanitizeHtmlLib from 'sanitize-html'

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
]

/**
 * Sanitize CMS HTML for safe rendering on the storefront.
 * Uses sanitize-html (Node-safe) instead of jsdom-based DOMPurify for Vercel compatibility.
 */
export function sanitizeCmsHtml(html: string): string {
  if (!html?.trim()) return ''

  return sanitizeHtmlLib(html, {
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
