'use client';

/**
 * Ensures first-party marketing cookies used by Meta Pixel and GA4/Google Ads
 * are present. This is helpful when GTM isn't able to set them (e.g. blocked
 * scripts) or when we want to persist fbclid/gclid from landing URLs.
 */

const DEFAULT_TTL_DAYS = 90;

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;

  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return undefined;
}

function setCookie(name: string, value: string, days: number = DEFAULT_TTL_DAYS) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Expires=${expires}; SameSite=Lax${secure}`;
}

function buildFbp(): string {
  const ts = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `fb.1.${ts}.${random}`;
}

/**
 * Ensure Meta and Google marketing cookies exist.
 * - `_fbp`: Meta Pixel browser id (first-party)
 * - `_fbc`: Meta click id (when fbclid is present)
 * - `_gcl_aw` / `_gcl_au` / `gclid`: Google click id persistence
 */
export function initMarketingCookies(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const params = new URLSearchParams(window.location.search);

  // Meta: set _fbp if missing
  const existingFbp = getCookie('_fbp');
  if (!existingFbp) {
    setCookie('_fbp', buildFbp());
  }

  // Meta: capture fbclid into _fbc when present in URL
  const fbclid = params.get('fbclid');
  if (fbclid) {
    const fbc = `fb.1.${Date.now()}.${fbclid}`;
    setCookie('_fbc', fbc);
  }

  // Google: capture gclid into first-party cookies
  const gclid = params.get('gclid');
  if (gclid) {
    const ts = Date.now();
    setCookie('gclid', gclid);
    setCookie('_gcl_aw', `GCL.${ts}.${gclid}`);
    setCookie('_gcl_au', `GCL.${ts}.${gclid}`);
  }
}

/**
 * Re-export helpers when a specific cookie is needed elsewhere.
 */
export const marketingCookies = {
  get: getCookie,
  set: setCookie,
};

