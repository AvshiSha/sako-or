import type { Product, VariantItem } from "@/lib/firebase";

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
  collectionStore.set(key, state);
  saveToSessionStorage(key, state);
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
  const existing = getCollectionState(key);
  if (!existing) return;
  setCollectionState(key, {
    ...existing,
    scrollY,
    updatedAt: Date.now(),
  });
}

/**
 * Persist current window scroll for a browse key without clobbering a saved position with 0.
 */
export function persistCollectionScroll(key: CollectionKey | undefined): void {
  if (!key || !isBrowser()) return;
  const scrollY = window.scrollY;
  const existing = getCollectionState(key);
  if (scrollY === 0 && existing && existing.scrollY > 0) return;
  if (existing) {
    mergeCollectionScroll(key, scrollY);
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
  lastKnownScrollY?: number
): void {
  let scrollY = isBrowser() ? window.scrollY : 0;
  if (scrollY === 0) {
    const existing = getCollectionState(key);
    scrollY = lastKnownScrollY ?? existing?.scrollY ?? 0;
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
  const y =
    override ??
    (isBrowser() ? window.scrollY : 0);
  if (y === 0 && !options?.allowZero) {
    const stored = getCollectionState(key);
    if (stored && stored.scrollY > 0) return stored.scrollY;
  }
  return y;
}

