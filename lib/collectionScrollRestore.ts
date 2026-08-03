/**
 * Collection scroll restoration for browser Back/Forward.
 *
 * Single source of truth: one sessionStorage record, written exactly once —
 * synchronously, right before the user navigates away to a product page —
 * and consumed exactly once, when the collection page's item list is ready
 * to render again. There is no continuous background scroll tracking and no
 * dependency on popstate/pageshow timing: restoration triggers purely from
 * "does the exact URL I just mounted have a saved position," which works
 * identically for Back, Forward, and a plain repeat visit to the same URL.
 *
 * The scroll value is only ever written while genuinely on a collection page
 * (see snapshotBeforeLeavingForProduct) — a product page's own scroll can
 * never reach this store, by construction.
 */

const STORAGE_KEY = "collection_scroll_restore_v2";
const SCROLL_TOLERANCE_PX = 12;
/** ~3.5s at 60fps — generous ceiling for slow image/layout settling before giving up. */
const MAX_RESTORE_FRAMES = 220;

export type CollectionKey = string;

type ScrollRecord = {
  browseKey: CollectionKey;
  path: string;
  scrollY: number;
  anchorKey?: string;
  savedAt: number;
};

let anchorMounter: ((anchorKey: string) => boolean) | null = null;
let activeRestore: { cancel: () => void } | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function currentPath(): string {
  return window.location.pathname + window.location.search;
}

export function isCollectionPath(path: string): boolean {
  return /\/collection/.test(path) && !/\/product\//.test(path);
}

export function isOnCollectionPage(): boolean {
  return isBrowser() && isCollectionPath(window.location.pathname);
}

function readRecord(): ScrollRecord | undefined {
  if (!isBrowser()) return undefined;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as ScrollRecord;
    if (
      !parsed ||
      typeof parsed.browseKey !== "string" ||
      typeof parsed.scrollY !== "number" ||
      parsed.scrollY <= 0 ||
      typeof parsed.path !== "string"
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function writeRecord(record: ScrollRecord): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore
  }
}

function clearRecord(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const COLLECTION_RETURN_EVENT = "collection-browse-return";

/**
 * When the grid is virtualized, an anchor card may be absent from the DOM
 * simply because it's scrolled outside the rendered window. CollectionClient
 * registers a mounter here that maps an anchor key to a flat item index: if
 * the anchor exists in the data, it nudges the virtualizer to mount it.
 */
export function registerCollectionAnchorMounter(
  fn: ((anchorKey: string) => boolean) | null
): void {
  anchorMounter = fn;
}

function escapeAnchorKey(anchorKey: string): string {
  try {
    return CSS.escape(anchorKey);
  } catch {
    return anchorKey;
  }
}

function queryAnchorElement(anchorKey: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-collection-anchor="${escapeAnchorKey(anchorKey)}"]`
  );
}

function isAnchorInView(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.top >= 0 && rect.top <= window.innerHeight * 0.6 && rect.bottom > 0;
}

function maxScrollTop(): number {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

/** Raw accessor for the pending restore record, if any (used by callers to gate their own item hydration). */
export function readLastCollectionScroll():
  | { browseKey: string; scrollY: number; path: string; savedAt: number }
  | undefined {
  return readRecord();
}

/**
 * Snapshot the collection's own scroll position right before navigating to a
 * product. Must be called synchronously, on the collection page, before the
 * click's navigation begins (e.g. onPointerDown/onClick of a product link).
 */
export function snapshotBeforeLeavingForProduct(
  browseKey: CollectionKey,
  anchorKey?: string
): void {
  if (!isBrowser() || !browseKey) return;
  if (!isOnCollectionPage()) return;

  const scrollY = window.scrollY;
  if (scrollY <= 0) return;

  writeRecord({
    browseKey,
    path: currentPath(),
    scrollY,
    anchorKey,
    savedAt: Date.now(),
  });
}

/** True while a restore is actively running — gates auto-load-more and append-preserve logic. */
export function hasPendingCollectionScrollRestore(): boolean {
  return activeRestore != null;
}

export function cancelCollectionScrollRestoreWatchdog(): void {
  activeRestore?.cancel();
  activeRestore = null;
}

/** Clear any saved restore target — call when filters/search change so a stale offset never applies to a new result set. */
export function resetCollectionScrollForFilterChange(): void {
  cancelCollectionScrollRestoreWatchdog();
  clearRecord();
}

/** Scroll to top after filter changes (call again on rAF if navigation runs after paint). */
export function scrollCollectionToTop(): void {
  if (!isBrowser()) return;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
}

export function dispatchCollectionBrowseReturn(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(COLLECTION_RETURN_EVENT));
}

/**
 * Restore scroll for `browseKey` if a saved record exists for the exact
 * current URL — call once the caller's item list has been hydrated from
 * cache and is ready to render. Only ever moves the scrollbar; never
 * fetches or mutates item state.
 *
 * Runs a single requestAnimationFrame polling loop (no parallel timers or
 * observers): each frame it checks whether the anchor card (or, without an
 * anchor, the page height) is ready to receive the target scroll, applies
 * it, and requires two consecutive stable frames before finishing — so a
 * still-growing virtualized grid or a late image can't be mistaken for
 * "arrived."
 */
export function beginCollectionScrollRestore(
  browseKey: CollectionKey,
  onComplete?: () => void
): void {
  if (!isBrowser()) {
    onComplete?.();
    return;
  }

  const record = readRecord();
  if (
    !record ||
    record.browseKey !== browseKey ||
    record.path !== currentPath() ||
    record.scrollY <= 0
  ) {
    onComplete?.();
    return;
  }

  // A restore is already running (for this key or another) — never start a
  // second, competing loop.
  if (activeRestore) {
    onComplete?.();
    return;
  }

  const targetY = record.scrollY;
  const anchorKey = record.anchorKey;

  let frame = 0;
  let stableTicks = 0;
  let lastAnchorTop: number | null = null;
  let rafId: number | null = null;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    if (rafId != null) cancelAnimationFrame(rafId);
    activeRestore = null;
    clearRecord();
    onComplete?.();
  };

  const cancel = () => {
    if (finished) return;
    finished = true;
    if (rafId != null) cancelAnimationFrame(rafId);
    activeRestore = null;
  };

  const scheduleNext = () => {
    if (frame >= MAX_RESTORE_FRAMES) {
      finish();
      return;
    }
    rafId = requestAnimationFrame(tick);
  };

  const tick = () => {
    if (finished) return;
    frame += 1;

    if (anchorKey) {
      let el = queryAnchorElement(anchorKey);
      if (!el) {
        // Not mounted — likely virtualized out of the rendered window. Nudge
        // the virtualizer toward it; if it mounts, a later tick finds it.
        anchorMounter?.(anchorKey);
        el = queryAnchorElement(anchorKey);
      }
      if (el) {
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
        const top = el.getBoundingClientRect().top;
        const stable = lastAnchorTop != null && Math.abs(top - lastAnchorTop) <= 2;
        lastAnchorTop = top;
        stableTicks = isAnchorInView(el) && stable ? stableTicks + 1 : 0;
        if (stableTicks >= 2) {
          finish();
          return;
        }
        scheduleNext();
        return;
      }
      lastAnchorTop = null;
      stableTicks = 0;
      scheduleNext();
      return;
    }

    // No anchor available — fall back to a plain pixel offset, but only once
    // the page has grown tall enough to actually reach it (never scroll to
    // maxScrollTop as a stand-in; that lands on the wrong spot).
    const reachable = maxScrollTop() >= targetY - SCROLL_TOLERANCE_PX;
    if (!reachable) {
      stableTicks = 0;
      scheduleNext();
      return;
    }

    if (Math.abs(window.scrollY - targetY) > SCROLL_TOLERANCE_PX) {
      window.scrollTo({ top: targetY, left: 0, behavior: "auto" });
      stableTicks = 0;
    } else {
      stableTicks += 1;
    }

    if (stableTicks >= 2) {
      finish();
      return;
    }
    scheduleNext();
  };

  activeRestore = { cancel };
  rafId = requestAnimationFrame(tick);
}
