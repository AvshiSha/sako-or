'use client';

/**
 * Once-per-order guard for the Purchase event.
 *
 * Two separate components report Purchase (the /Success page and PaymentResult), and
 * the success page is reachable repeatedly — a refresh, a back-navigation or a shared
 * link all re-mount it. The in-component `useRef` guards only survive within one
 * mount, so they do not stop a reload from reporting the same order again.
 *
 * This is the first of two layers. The second is the deterministic `eventID` that
 * `trackPurchase` derives from the same order number, which lets Meta collapse any
 * duplicate that still gets through (a different browser, cleared storage, or the
 * same order later reported by the Conversions API).
 */

const STORAGE_KEY = 'sako_tracked_purchases';
const MAX_REMEMBERED_ORDERS = 50;

function readTrackedOrders(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
  } catch {
    // Private mode / storage disabled / corrupt value — fall back to "not yet tracked".
    return [];
  }
}

/**
 * Stable id for the Purchase event of one order, shared by the browser pixel and the
 * server-side (Stape) report.
 *
 * Deliberately the order number verbatim, with no prefix. It is the same value the
 * GA4 `purchase` event carries as `ecommerce.transaction_id`, which is what a
 * server-side Meta tag normally maps `event_id` from — a decorated value like
 * `purchase.<orderNumber>` would silently fail to match that and defeat the dedup it
 * was meant to provide. `trackPurchase` also publishes it as a top-level `event_id`
 * on the dataLayer so the server tag can be pointed at it explicitly.
 */
export function buildPurchaseEventId(orderNumber: string): string {
  return orderNumber;
}

export function hasPurchaseBeenTracked(orderNumber: string): boolean {
  if (!orderNumber) return false;
  return readTrackedOrders().includes(orderNumber);
}

export function markPurchaseTracked(orderNumber: string): void {
  if (typeof window === 'undefined' || !orderNumber) return;

  try {
    const tracked = readTrackedOrders();
    if (tracked.includes(orderNumber)) return;

    tracked.push(orderNumber);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(tracked.slice(-MAX_REMEMBERED_ORDERS))
    );
  } catch {
    // Storage unavailable: the deterministic eventID still dedupes this at Meta.
  }
}
