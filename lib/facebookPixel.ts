'use client';

/**
 * Facebook / Meta Pixel utilities.
 * All public helpers guard against SSR and missing fbq to avoid runtime errors.
 */

export const FACEBOOK_PIXEL_ID = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;

type TrackCommand = 'track' | 'trackCustom';

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

export function initFacebookPixel(): void {
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
  if (FACEBOOK_PIXEL_ID && fbq) {
    fbq('init', FACEBOOK_PIXEL_ID);
    fbq('track', 'PageView');
  } else if (!FACEBOOK_PIXEL_ID) {
    console.warn('[FacebookPixel] Missing NEXT_PUBLIC_FACEBOOK_PIXEL_ID; pixel not initialized.');
  }
}

export function fbqTrack(eventName: string, params?: Record<string, any>, isCustom: boolean = false): void {
  if (typeof window === 'undefined') return;
  if (!window.fbq) {
    warnMissingFbq(eventName);
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

