'use client';

import Cookies from 'js-cookie';

/**
 * Reads Meta's `_fbp` (Browser ID) and `_fbc` (Click ID) cookies so they can be put
 * on the dataLayer for the server-side tag to forward.
 *
 * Why this is needed at all: the browser pixel never needs help here — fbevents.js
 * reads these cookies itself, which is why Meta reports 100% fbp coverage on the
 * browser channel. A server-side Conversions API call is different: it only has the
 * cookies the request carried, so a server container that is not on a cookie-sharing
 * first-party domain, or that is fed by a transport which does not forward them,
 * sends Purchase with no fbp at all. Publishing the values on the dataLayer removes
 * that dependency — the server tag can map them from the event payload either way.
 *
 * Both cookies are first-party values Meta itself set; this only forwards them.
 */

export interface MetaBrowserIds {
  /** Meta Browser ID, format `fb.1.<timestamp>.<random>`. */
  fbp?: string;
  /** Meta Click ID, derived by the pixel from an `fbclid` landing parameter. */
  fbc?: string;
}

function readCookie(name: string): string | undefined {
  try {
    const value = Cookies.get(name);
    return value?.trim() ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Current `_fbp` / `_fbc` values, omitting whichever is absent.
 *
 * `_fbp` is missing on a first page view until fbevents.js writes it, and stays
 * missing when a blocker prevents the pixel loading — so callers must treat both
 * keys as optional rather than assuming a value is there.
 */
export function readMetaBrowserIds(): MetaBrowserIds {
  if (typeof window === 'undefined') return {};

  const ids: MetaBrowserIds = {};

  const fbp = readCookie('_fbp');
  if (fbp) ids.fbp = fbp;

  const fbc = readCookie('_fbc');
  if (fbc) ids.fbc = fbc;

  return ids;
}
