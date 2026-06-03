import type { Product, VariantItem } from "@/lib/firebase";
import {
  freezeCollectionScrollForBack,
  isCollectionScrollLocked,
  readFrozenCollectionScroll,
  readLastCollectionScroll,
  saveLastCollectionScroll,
} from "@/lib/collectionScrollRestore";

function collectionPathFromWindow(): string | undefined {
  if (!isBrowser()) return undefined;
  const path = window.location.pathname + window.location.search;
  return path.includes("/collection") && !path.includes("/product/")
    ? path
    : undefined;
}

export type CollectionKey = string;

export interface CollectionBrowseState {
  useVariantItems: boolean;
  items: VariantItem[] | Product[];
  currentPage: number;
  totalProducts: number;
  hasMore: boolean;
  scrollY: number;
  updatedAt: number;
}

// In-memory store scoped to the current browser tab.
// This is intentionally simple and localized to the collection page UX.
const collectionStore = new Map<CollectionKey, CollectionBrowseState>();

const STORAGE_PREFIX = "collection_state_v1:";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function loadFromSessionStorage(key: CollectionKey): CollectionBrowseState | undefined {
  if (!isBrowser()) return undefined;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CollectionBrowseState;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.currentPage !== "number" ||
      typeof parsed.totalProducts !== "number"
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function saveToSessionStorage(key: CollectionKey, state: CollectionBrowseState): void {
  if (!isBrowser()) return;
  try {
    const raw = JSON.stringify(state);
    window.sessionStorage.setItem(STORAGE_PREFIX + key, raw);
  } catch {
    // Ignore quota/serialization errors; UX will just fall back to fresh state.
  }
}

/** Apply stored list/scroll for a browse key (e.g. after browser Back). */
export function hydrateCollectionBrowseFromStore(
  key: CollectionKey
): CollectionBrowseState | undefined {
  const stored = getCollectionState(key);
  if (!stored) return undefined;
  collectionStore.set(key, stored);
  return stored;
}

export function getCollectionState(
  key: CollectionKey
): CollectionBrowseState | undefined {
  const inMemory = collectionStore.get(key);
  if (inMemory) return inMemory;

  const fromStorage = loadFromSessionStorage(key);
  if (fromStorage) {
    collectionStore.set(key, fromStorage);
    return fromStorage;
  }

  return undefined;
}

export function setCollectionState(
  key: CollectionKey,
  state: CollectionBrowseState
): void {
  const existing = getCollectionState(key);
  const frozen = readFrozenCollectionScroll();
  let scrollY = state.scrollY;
  if (!collectionPathFromWindow()) {
    scrollY = Math.max(
      scrollY,
      existing?.scrollY ?? 0,
      frozen?.browseKey === key ? frozen.scrollY : 0
    );
  }
  const next = scrollY === state.scrollY ? state : { ...state, scrollY };
  collectionStore.set(key, next);
  saveToSessionStorage(key, next);
}

export function clearCollectionState(key: CollectionKey): void {
  collectionStore.delete(key);
  if (isBrowser()) {
    try {
      window.sessionStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      // Ignore
    }
  }
}

/** Update only scroll position on an existing browse entry. */
export function mergeCollectionScroll(
  key: CollectionKey,
  scrollY: number
): void {
  if (!collectionPathFromWindow() || isCollectionScrollLocked()) return;

  const existing = getCollectionState(key);
  if (!existing) return;
  const resolvedScrollY =
    scrollY > 0 ? scrollY : existing.scrollY > 0 ? existing.scrollY : 0;
  setCollectionState(key, {
    ...existing,
    scrollY: resolvedScrollY,
    updatedAt: Date.now(),
  });
}

/**
 * Persist current window scroll for a browse key without clobbering a saved position with 0.
 */
export function persistCollectionScroll(key: CollectionKey | undefined): void {
  if (!key || !isBrowser() || !collectionPathFromWindow()) return;
  if (isCollectionScrollLocked()) return;
  const scrollY = window.scrollY;
  const existing = getCollectionState(key);
  if (scrollY === 0 && existing && existing.scrollY > 0) return;
  if (existing) {
    mergeCollectionScroll(key, scrollY);
    if (scrollY > 0) {
      saveLastCollectionScroll(key, scrollY, collectionPathFromWindow());
    }
  }
}

/**
 * Save list + scroll immediately before navigating to a product page.
 * Creates an entry if none exists yet (e.g. fast tap before debounced scroll save).
 */
export function persistCollectionBrowseBeforeNavigate(
  key: CollectionKey | undefined,
  snapshot: CollectionBrowseSnapshot | null | undefined
): void {
  if (!key || !isBrowser() || !snapshot) return;
  const scrollY = window.scrollY;
  const existing = getCollectionState(key);
  const resolvedScrollY =
    scrollY > 0 ? scrollY : existing?.scrollY ?? 0;
  setCollectionState(key, {
    ...snapshot,
    scrollY: resolvedScrollY,
    updatedAt: Date.now(),
  });
  const collectionPath = collectionPathFromWindow();
  if (resolvedScrollY > 0 && collectionPath) {
    freezeCollectionScrollForBack(key, resolvedScrollY, collectionPath);
  }
}

export type CollectionBrowseSnapshot = Omit<
  CollectionBrowseState,
  "scrollY" | "updatedAt"
>;

/**
 * Save full browse state when leaving the page. If the document is already at scroll 0
 * (common during Next.js client navigation), keep the last known scroll position.
 */
export function saveCollectionStateOnLeave(
  key: CollectionKey,
  snapshot: CollectionBrowseSnapshot,
  lastKnownScrollY?: number,
  collectionPath?: string
): void {
  const existing = getCollectionState(key);
  const frozen = readFrozenCollectionScroll();
  const onCollection = !!collectionPathFromWindow();
  let scrollY = onCollection && isBrowser() ? window.scrollY : 0;
  if (!onCollection || scrollY === 0) {
    scrollY = lastKnownScrollY ?? existing?.scrollY ?? 0;
  }
  if (frozen?.browseKey === key) {
    scrollY = Math.max(scrollY, frozen.scrollY);
  }
  const fromSession = readLastCollectionScroll();
  if (fromSession?.browseKey === key && fromSession.scrollY > scrollY) {
    scrollY = fromSession.scrollY;
  }
  setCollectionState(key, {
    ...snapshot,
    scrollY,
    updatedAt: Date.now(),
  });
}

/** Resolve scrollY for persistence, avoiding overwrite with 0 while a restore is pending. */
export function resolveBrowseScrollY(
  key: CollectionKey,
  override?: number,
  options?: { allowZero?: boolean }
): number {
  const frozenEntry = readFrozenCollectionScroll();
  const frozen =
    frozenEntry?.browseKey === key ? frozenEntry.scrollY : 0;

  const y =
    override ??
    (isBrowser() && collectionPathFromWindow() ? window.scrollY : 0);
  if (y === 0 && !options?.allowZero) {
    const stored = getCollectionState(key);
    if (stored && stored.scrollY > 0) return Math.max(stored.scrollY, frozen);
    if (frozen > 0) return frozen;
  }
  return Math.max(y, frozen);
}

