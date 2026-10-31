const GTM_ID = 'GTM-T6QKL299'

let gtmLoaded = false

/**
 * Load Google Tag Manager after first paint / cookie notice dismissed.
 *
 * NOTE: this container holds no Meta Pixel — verified against the published
 * container, which contains no `fbq`/`facebook` reference and not the pixel id.
 * The browser pixel is loaded by `lib/facebookPixel.ts` instead, so that file is
 * the only browser-side Meta source and is not a duplicate of a GTM tag.
 */
export function loadGoogleTagManager(): void {
  if (typeof window === 'undefined' || gtmLoaded) return
  gtmLoaded = true

  const w = window as Window & { dataLayer?: unknown[] }
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`
  document.head.appendChild(script)
}
