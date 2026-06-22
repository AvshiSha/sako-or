const GTM_ID = 'GTM-T6QKL299'

let gtmLoaded = false

/**
 * Load Google Tag Manager after first paint / cookie notice dismissed.
 * Meta Pixel should be configured inside GTM only (no duplicate FB script).
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
