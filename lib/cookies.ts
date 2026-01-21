'use client';

import Cookies from 'js-cookie';

/**
 * Cookie utility functions for managing cookies and consent
 */

const COOKIE_CONSENT_KEY = 'cookie_consent';
const COOKIE_CONSENT_EXPIRY_DAYS = 365;

export type CookieConsent = {
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
};

const cookieOptions: Cookies.CookieAttributes = {
  expires: COOKIE_CONSENT_EXPIRY_DAYS,
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};

/**
 * Get cookie consent preferences
 */
export function getCookieConsent(): CookieConsent | null {
  const consent = Cookies.get(COOKIE_CONSENT_KEY);
  if (!consent) return null;
  
  try {
    return JSON.parse(consent);
  } catch {
    return null;
  }
}

/**
 * Set cookie consent preferences
 */
export function setCookieConsent(consent: CookieConsent): void {
  Cookies.set(COOKIE_CONSENT_KEY, JSON.stringify(consent), cookieOptions);
}

/**
 * Check if user has given consent for analytics cookies
 */
export function hasAnalyticsConsent(): boolean {
  const consent = getCookieConsent();
  return consent?.analytics === true;
}

/**
 * Check if user has given consent for marketing cookies
 */
export function hasMarketingConsent(): boolean {
  const consent = getCookieConsent();
  return consent?.marketing === true;
}

/**
 * Check if user has given any consent
 */
export function hasAnyConsent(): boolean {
  const consent = getCookieConsent();
  return consent !== null;
}

/**
 * Wait for cookie consent (useful for Facebook Pixel initialization)
 */
export function waitForConsent(
  callback: () => void,
  checkInterval: number = 100,
  timeout: number = 10000
): void {
  if (typeof window === 'undefined') return;
  
  const startTime = Date.now();
  
  const checkConsent = () => {
    if (hasMarketingConsent()) {
      callback();
      return;
    }
    
    if (Date.now() - startTime > timeout) {
      console.warn('[Cookies] Consent timeout reached');
      return;
    }
    
    setTimeout(checkConsent, checkInterval);
  };
  
  checkConsent();
}

/**
 * Remove cookie consent (for testing or user preference changes)
 */
export function removeCookieConsent(): void {
  Cookies.remove(COOKIE_CONSENT_KEY, { path: '/' });
}

/**
 * Cookie notice tracking (for Israel - no consent needed, just inform users)
 */
const COOKIE_NOTICE_SEEN_KEY = 'cookie_notice_seen';

/**
 * Check if cookie notice has been seen
 */
export function hasCookieNoticeBeenSeen(): boolean {
  return Cookies.get(COOKIE_NOTICE_SEEN_KEY) === 'true';
}

/**
 * Mark cookie notice as seen
 */
export function setCookieNoticeSeen(): void {
  Cookies.set(COOKIE_NOTICE_SEEN_KEY, 'true', cookieOptions);
}
