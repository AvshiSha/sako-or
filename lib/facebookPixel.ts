'use client';

import { normalizeIsraelE164 } from '@/lib/phone';

/**
 * Facebook / Meta Pixel utilities.
 * All public helpers guard against SSR and missing fbq to avoid runtime errors.
 */

export const FACEBOOK_PIXEL_ID = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;

/** Meta Pixel manual advanced matching fields (hashed automatically by fbq). */
export interface AdvancedMatchingData {
  em?: string;
  ph?: string;
  fn?: string;
  ln?: string;
  ct?: string;
  st?: string;
  zp?: string;
  country?: string;
  db?: string;
  ge?: string;
}

type TrackCommand = 'track' | 'trackCustom';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Meta expects digits only, with country code (e.g. 972504487979). */
function normalizePhone(phone: string): string | undefined {
  const e164 = normalizeIsraelE164(phone);
  if (e164) return e164.slice(1);

  let digits = phone.trim().replace(/\D/g, '');
  if (!digits) return undefined;

  while (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('972')) {
    const national = digits.slice(3);
    if (national.length >= 8 && national.length <= 9) {
      return `972${national}`;
    }
    return undefined;
  }

  if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 10) {
    return `972${digits.slice(1)}`;
  }

  return digits.length >= 10 ? digits : undefined;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

type AdvancedMatchingInput = {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
};

export type { AdvancedMatchingInput };

/** Omits null/undefined keys so merge inherits accumulated values instead of clearing. */
export function omitNullAdvancedMatchingFields(input: AdvancedMatchingInput): AdvancedMatchingInput {
  const result: AdvancedMatchingInput = {};
  for (const key of Object.keys(input) as Array<keyof AdvancedMatchingInput>) {
    const value = input[key];
    if (value != null) {
      result[key] = value;
    }
  }
  return result;
}

/** Accumulated raw inputs for the current user identity; fbq('init') replaces rather than merges. */
let accumulatedAdvancedMatchingInput: AdvancedMatchingInput = {};
let accumulatedIdentity: { em?: string; ph?: string } = {};

function hasAdvancedMatchingValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function extractIdentity(input: AdvancedMatchingInput): { em?: string; ph?: string } {
  const identity: { em?: string; ph?: string } = {};
  if (hasAdvancedMatchingValue(input.email)) {
    identity.em = normalizeEmail(input.email);
  }
  if (hasAdvancedMatchingValue(input.phone)) {
    const ph = normalizePhone(input.phone);
    if (ph) identity.ph = ph;
  }
  return identity;
}

function hasStoredIdentity(): boolean {
  return Boolean(accumulatedIdentity.em || accumulatedIdentity.ph);
}

function identityConflictsWithStored(incoming: { em?: string; ph?: string }): boolean {
  if (!hasStoredIdentity()) return false;
  if (incoming.em && accumulatedIdentity.em && incoming.em !== accumulatedIdentity.em) return true;
  if (incoming.ph && accumulatedIdentity.ph && incoming.ph !== accumulatedIdentity.ph) return true;
  return false;
}

function mergeAdvancedMatchingInput(partial: AdvancedMatchingInput): AdvancedMatchingInput {
  const incomingIdentity = extractIdentity(partial);

  if (identityConflictsWithStored(incomingIdentity)) {
    accumulatedAdvancedMatchingInput = {};
    accumulatedIdentity = {};
  }

  if (incomingIdentity.em) accumulatedIdentity.em = incomingIdentity.em;
  if (incomingIdentity.ph) accumulatedIdentity.ph = incomingIdentity.ph;

  const merged: AdvancedMatchingInput = { ...accumulatedAdvancedMatchingInput };

  for (const key of Object.keys(partial) as Array<keyof AdvancedMatchingInput>) {
    const value = partial[key];
    if (hasAdvancedMatchingValue(value)) {
      merged[key] = value;
    } else if (value !== undefined) {
      // Explicit null or empty string — do not inherit a stale value from a prior submission.
      delete merged[key];
    }
  }

  accumulatedAdvancedMatchingInput = merged;
  return merged;
}

const ADVANCED_MATCHING_PIXEL_KEYS = [
  'em',
  'ph',
  'fn',
  'ln',
  'ct',
  'st',
  'zp',
  'country',
  'db',
  'ge',
  'external_id',
] as const;

function clearFbqAdvancedMatchingOnPixel(): void {
  const pixelId = FACEBOOK_PIXEL_ID;
  if (typeof window === 'undefined' || !pixelId || !window.fbq) return;

  // Re-init without a third param replaces prior manual advanced matching on the pixel.
  window.fbq('init', pixelId);

  const pixelState = (window.fbq as any)?.instance?.pixelsByID?.[pixelId];
  if (pixelState?.userData && typeof pixelState.userData === 'object') {
    for (const key of ADVANCED_MATCHING_PIXEL_KEYS) {
      delete pixelState.userData[key];
    }
  }
}

export function resetFacebookPixelAdvancedMatching(): void {
  accumulatedAdvancedMatchingInput = {};
  accumulatedIdentity = {};
  clearFbqAdvancedMatchingOnPixel();
}

export function buildAdvancedMatchingData(input: AdvancedMatchingInput): AdvancedMatchingData | undefined {
  const data: AdvancedMatchingData = {};

  if (input.email?.trim()) data.em = normalizeEmail(input.email);
  if (input.phone?.trim()) {
    const ph = normalizePhone(input.phone);
    if (ph) data.ph = ph;
  }
  if (input.firstName?.trim()) data.fn = normalizeName(input.firstName);
  if (input.lastName?.trim()) data.ln = normalizeName(input.lastName);
  if (input.city?.trim()) data.ct = normalizeName(input.city);
  if (input.state?.trim()) data.st = normalizeName(input.state);
  if (input.zip?.trim()) data.zp = input.zip.trim().toLowerCase();
  if (input.country?.trim()) data.country = normalizeName(input.country);

  return Object.keys(data).length > 0 ? data : undefined;
}

/** Sync-key helper using the same normalization as data sent to fbq('init'). */
const ADVANCED_MATCHING_SYNC_KEY_FIELDS: Array<keyof AdvancedMatchingData> = [
  'em',
  'ph',
  'fn',
  'ln',
  'ct',
  'st',
  'zp',
  'country',
];

export function buildAdvancedMatchingSyncKey(uid: string, input: AdvancedMatchingInput): string {
  const normalized = buildAdvancedMatchingData(input);
  return [
    uid,
    ...ADVANCED_MATCHING_SYNC_KEY_FIELDS.map((field) => normalized?.[field] ?? ''),
  ].join(':');
}

function getAccumulatedAdvancedMatchingData(): AdvancedMatchingData | undefined {
  return buildAdvancedMatchingData(accumulatedAdvancedMatchingInput);
}

const FBQ_POLL_INTERVAL_MS = 200;
const FBQ_WARN_AFTER_MS = 10_000;
const FBQ_INIT_RETRY_INTERVAL_MS = 10_000;

let fbqReadyCallbacks: Array<() => void> = [];
let fbqPollTimer: ReturnType<typeof setTimeout> | null = null;
let fbqPollStartedAt: number | null = null;
let fbqWarnLogged = false;
let fbqLastInitRetryAt = 0;

function runFbqReadyCallbacks(): void {
  if (typeof window === 'undefined' || !window.fbq) return;

  const callbacks = fbqReadyCallbacks;
  fbqReadyCallbacks = [];
  stopFbqPolling();

  for (const callback of callbacks) {
    try {
      callback();
    } catch (error) {
      console.warn('[FacebookPixel] fbq ready callback failed', error);
    }
  }
}

function stopFbqPolling(): void {
  if (fbqPollTimer !== null) {
    clearTimeout(fbqPollTimer);
    fbqPollTimer = null;
  }
  fbqPollStartedAt = null;
  fbqWarnLogged = false;
}

function pollForFbq(): void {
  if (typeof window === 'undefined') return;

  if (window.fbq) {
    runFbqReadyCallbacks();
    return;
  }

  if (fbqReadyCallbacks.length === 0) {
    stopFbqPolling();
    return;
  }

  const now = Date.now();
  const startedAt = fbqPollStartedAt ?? now;
  fbqPollStartedAt = startedAt;

  if (now - fbqLastInitRetryAt >= FBQ_INIT_RETRY_INTERVAL_MS) {
    fbqLastInitRetryAt = now;
    initFacebookPixel(getAccumulatedAdvancedMatchingData());
  }

  if (!fbqWarnLogged && now - startedAt >= FBQ_WARN_AFTER_MS) {
    fbqWarnLogged = true;
    console.warn('[FacebookPixel] fbq still loading; continuing to wait for advanced matching');
  }

  fbqPollTimer = setTimeout(pollForFbq, FBQ_POLL_INTERVAL_MS);
}

function whenFbqReady(callback: () => void): void {
  if (typeof window === 'undefined') return;
  if (window.fbq) {
    callback();
    return;
  }

  fbqReadyCallbacks.push(callback);

  if (fbqPollTimer !== null) return;

  fbqPollStartedAt = Date.now();
  fbqLastInitRetryAt = Date.now();
  fbqWarnLogged = false;
  initFacebookPixel(getAccumulatedAdvancedMatchingData());
  fbqPollTimer = setTimeout(pollForFbq, FBQ_POLL_INTERVAL_MS);
}

/**
 * Send manual advanced matching to an already-initialized pixel (e.g. loaded via GTM).
 * Merges fields for the same user identity (email/phone) so partial updates in one
 * flow (login → checkout → purchase) stay complete. Resets all accumulated data
 * when identity changes. Omitted fields are inherited; explicitly empty fields are cleared.
 */
export function setFacebookPixelAdvancedMatching(input: AdvancedMatchingInput): void {
  const pixelId = FACEBOOK_PIXEL_ID;
  mergeAdvancedMatchingInput(input);
  if (!pixelId || !getAccumulatedAdvancedMatchingData()) return;

  whenFbqReady(() => {
    if (!window.fbq) return;
    const advancedMatching = getAccumulatedAdvancedMatchingData();
    if (!advancedMatching) return;
    window.fbq('init', pixelId, advancedMatching);
  });
}

export interface PixelContent {
  id: string;
  quantity?: number;
  item_price?: number;
  brand?: string;
  item_variant?: string;
}

export interface PixelEventOptions {
  currency?: string;
  value?: number;
}

function warnMissingFbq(eventName: string) {
  if (typeof window === 'undefined') return;
  if (!window.fbq) {
    console.warn('[FacebookPixel] fbq is not defined. Event not sent:', eventName);
  }
}

/**
 * Initialize Facebook Pixel (no consent required in Israel - just inform users)
 */
export function initFacebookPixel(advancedMatching?: AdvancedMatchingData): void {
  if (typeof window === 'undefined') return;
  if (window.fbq) return;

  // Meta Pixel base code
  (function (f: any, b: any, e: any, v?: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function () {
      (n!.callMethod ? n!.callMethod.apply(n, arguments) : n!.queue!.push(arguments));
    };
    if (!f._fbq) f._fbq = n;
    n!.push = n!.push || [];
    n!.loaded = true;
    n!.version = '2.0';
    n!.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = 'https://connect.facebook.net/en_US/fbevents.js';
    s = b.getElementsByTagName(e)[0];
    s.parentNode!.insertBefore(t, s);
  })(window, document, 'script');

  // Type assertion needed because TypeScript doesn't track the IIFE's side effects
  const fbq = (window as any).fbq as FacebookPixel | undefined;
  const pixelId = FACEBOOK_PIXEL_ID;

  if (pixelId && fbq) {
    // Avoid duplicate init if another script (e.g. GTM) already initialized this pixel
    const isPixelInitialized = Boolean(fbq.getState?.()?.pixels?.[pixelId]);
    if (isPixelInitialized) return;

    fbq('init', pixelId, advancedMatching);

    // Avoid double PageView (e.g., GTM also fires PageView)
    const pageViewSentFlag = '__fbqPageViewSent';
    const winAny = window as any;
    if (!winAny[pageViewSentFlag]) {
      fbq('track', 'PageView');
      winAny[pageViewSentFlag] = true;
    }
  } else if (!FACEBOOK_PIXEL_ID) {
    console.warn('[FacebookPixel] Missing NEXT_PUBLIC_FACEBOOK_PIXEL_ID; pixel not initialized.');
  }
}

export function fbqTrack(
  eventName: string,
  params?: Record<string, any>,
  isCustom: boolean = false,
  attempt: number = 0
): void {
  if (typeof window === 'undefined') return;

  if (!window.fbq) {
    // Try to initialize pixel once if missing, then retry once after a short delay.
    if (attempt === 0) {
      initFacebookPixel();
      setTimeout(() => fbqTrack(eventName, params, isCustom, attempt + 1), 250);
    } else {
      warnMissingFbq(eventName);
    }
    return;
  }

  const command: TrackCommand = isCustom ? 'trackCustom' : 'track';
  window.fbq(command, eventName, params);
}

export function fbqTrackAddToCart(
  items: PixelContent[],
  options: PixelEventOptions = {}
): void {
  if (!items || items.length === 0) return;

  const value = options.value ?? items.reduce((sum, item) => sum + (item.item_price || 0) * (item.quantity || 1), 0);
  fbqTrack('AddToCart', {
    currency: options.currency || 'ILS',
    value,
    content_type: 'product',
    content_ids: items.map((item) => item.id),
    contents: items.map((item) => ({
      id: item.id,
      quantity: item.quantity || 1,
      item_price: item.item_price,
      brand: item.brand,
      item_variant: item.item_variant,
    })),
  });
}

export function fbqTrackAddToFavorites(item: PixelContent): void {
  if (!item?.id) return;
  fbqTrack(
    'AddToFavorites',
    {
      content_type: 'product',
      content_ids: [item.id],
      contents: [
        {
          id: item.id,
          quantity: item.quantity || 1,
          item_price: item.item_price,
          brand: item.brand,
          item_variant: item.item_variant,
        },
      ],
    },
    true
  );
}

export function fbqTrackRemoveFromFavorites(item: PixelContent): void {
  if (!item?.id) return;
  fbqTrack(
    'RemoveFromFavorites',
    {
      content_type: 'product',
      content_ids: [item.id],
      contents: [
        {
          id: item.id,
          quantity: item.quantity || 1,
          item_price: item.item_price,
          brand: item.brand,
          item_variant: item.item_variant,
        },
      ],
    },
    true
  );
}

export function fbqTrackSubscribe(params: Record<string, any>): void {
  fbqTrack('Subscribe', params, true);
}

export function fbqTrackInitiateCheckout(
  items: PixelContent[],
  options: PixelEventOptions & { num_items?: number } = {}
): void {
  if (!items || items.length === 0) return;

  const value = options.value ?? items.reduce((sum, item) => sum + (item.item_price || 0) * (item.quantity || 1), 0);
  fbqTrack('InitiateCheckout', {
    currency: options.currency || 'ILS',
    value,
    num_items: options.num_items ?? items.reduce((sum, item) => sum + (item.quantity || 1), 0),
    content_type: 'product',
    content_ids: items.map((item) => item.id),
    contents: items.map((item) => ({
      id: item.id,
      quantity: item.quantity || 1,
      item_price: item.item_price,
      brand: item.brand,
      item_variant: item.item_variant,
    })),
  });
}

export function fbqTrackViewContent(
  item: PixelContent,
  options: PixelEventOptions = {}
): void {
  if (!item?.id) return;

  fbqTrack('ViewContent', {
    content_type: 'product',
    content_ids: [item.id],
    contents: [
      {
        id: item.id,
        quantity: item.quantity || 1,
        item_price: item.item_price,
        brand: item.brand,
        item_variant: item.item_variant,
      },
    ],
    currency: options.currency || 'ILS',
    value: options.value ?? item.item_price ?? 0,
  });
}

export function fbqTrackPurchase(
  items: PixelContent[],
  options: PixelEventOptions = {}
): void {
  if (!items || items.length === 0) return;

  const value = options.value ?? items.reduce((sum, item) => sum + (item.item_price || 0) * (item.quantity || 1), 0);
  fbqTrack('Purchase', {
    currency: options.currency || 'ILS',
    value,
    contents: items.map((item) => ({
      id: item.id,
      quantity: item.quantity || 1,
      item_price: item.item_price,
      brand: item.brand,
      item_variant: item.item_variant,
    })),
    content_ids: items.map((item) => item.id),
    content_type: 'product',
  });
}

