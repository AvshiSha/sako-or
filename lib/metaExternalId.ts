'use client';

import Cookies from 'js-cookie';

/**
 * Meta `external_id` advanced-matching identifier.
 *
 * Meta treats external_id as "any unique ID from the advertiser", and matches on it
 * only when the *same* value is reported for the same person across events — so the
 * value has to be stable, not regenerated per page view or per event.
 *
 * Signed-in visitors use their Firebase uid, which is already this app's canonical
 * user key (FacebookPixel.tsx was previously using it only to build a local sync key).
 * Guests get a random first-party id persisted in a cookie: that is what makes a
 * guest purchase matchable at all, since there is no account to key it to.
 *
 * The value is sent raw rather than SHA-256 hashed, deliberately. Meta normalizes and
 * hashes a raw external_id on its side, and the browser pixel and any future
 * Conversions API call have to agree on the value for matching and dedup to work —
 * agreeing on one raw id is easier to keep true than agreeing on a hash computed in
 * two places. Neither a Firebase uid nor a random guest id is personal information.
 */

const GUEST_EXTERNAL_ID_COOKIE = 'sako_ext_id';
const GUEST_EXTERNAL_ID_EXPIRY_DAYS = 365;

const cookieOptions: Cookies.CookieAttributes = {
  expires: GUEST_EXTERNAL_ID_EXPIRY_DAYS,
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};

function randomId(): string {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : undefined;

  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();

  if (cryptoObj?.getRandomValues) {
    const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

/**
 * Reads the persisted guest identifier, creating it on first call.
 * Never throws: with cookies blocked, advanced matching simply goes without
 * external_id rather than breaking the event.
 */
export function getGuestExternalId(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    const existing = Cookies.get(GUEST_EXTERNAL_ID_COOKIE);
    if (existing?.trim()) return existing.trim();

    const created = randomId();
    Cookies.set(GUEST_EXTERNAL_ID_COOKIE, created, cookieOptions);
    return created;
  } catch {
    return undefined;
  }
}

/** The Firebase uid when signed in, otherwise the persisted guest id. */
export function resolveMetaExternalId(uid?: string | null): string | undefined {
  if (typeof uid === 'string' && uid.trim()) return uid.trim();
  return getGuestExternalId();
}
