import DOMPurify from 'isomorphic-dompurify'

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

const ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'title',
  'width',
  'height',
  'loading',
  'allow',
  'allowfullscreen',
  'frameborder',
  'class',
  'data-youtube-video',
]

function isYouTubeIframe(src: string | null | undefined): boolean {
  if (!src) return false
  try {
    const url = new URL(src)
    return (
      url.hostname === 'www.youtube.com' ||
      url.hostname === 'youtube.com' ||
      url.hostname === 'www.youtube-nocookie.com' ||
      url.hostname === 'youtube-nocookie.com'
    )
  } catch {
    return false
  }
}

/**
 * Sanitize CMS HTML for safe rendering on the storefront.
 */
export function sanitizeCmsHtml(html: string): string {
  if (!html?.trim()) return ''

  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_ATTR: ['target', 'rel'],
  })

  // Post-process: enforce safe link attrs and YouTube-only iframes
  if (typeof window !== 'undefined') {
    const doc = new DOMParser().parseFromString(sanitized, 'text/html')

    doc.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href') || ''
      if (href.startsWith('http://') || href.startsWith('https://')) {
        anchor.setAttribute('target', '_blank')
        anchor.setAttribute('rel', 'noopener noreferrer')
      }
    })

    doc.querySelectorAll('iframe').forEach((iframe) => {
      const src = iframe.getAttribute('src')
      if (!isYouTubeIframe(src)) {
        iframe.remove()
      } else {
        iframe.setAttribute('loading', 'lazy')
        iframe.setAttribute('allowfullscreen', 'true')
      }
    })

    doc.querySelectorAll('img').forEach((img) => {
      img.setAttribute('loading', 'lazy')
    })

    return doc.body.innerHTML
  }

  // Server-side: regex-based post-processing
  let result = sanitized

  result = result.replace(
    /<iframe([^>]*?)src="([^"]*)"([^>]*?)>/gi,
    (_match, before, src, after) => {
      if (!isYouTubeIframe(src)) return ''
      return `<iframe${before}src="${src}"${after} loading="lazy" allowfullscreen="true">`
    }
  )

  result = result.replace(
    /<a([^>]*?)href="(https?:\/\/[^"]*)"([^>]*)>/gi,
    '<a$1href="$2"$3 target="_blank" rel="noopener noreferrer">'
  )

  result = result.replace(/<img /gi, '<img loading="lazy" ')

  return result
}
