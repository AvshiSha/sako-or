import type { Product, VariantItem } from "@/lib/firebase";

export type CollectionKey = string;

export interface CollectionBrowseState {
  useVariantItems: boolean;
  items: VariantItem[] | Product[];
  currentPage: number;
  totalProducts: number;
  hasMore: boolean;
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

/** Apply stored list/page state for a browse key (e.g. after browser Back). */
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

function mergeBrowseItems(
  existing: CollectionBrowseState | undefined,
  incoming: CollectionBrowseState
): CollectionBrowseState {
  if (
    !existing ||
    !Array.isArray(existing.items) ||
    existing.items.length === 0
  ) {
    return incoming;
  }
  if (!Array.isArray(incoming.items) || incoming.items.length === 0) {
    return {
      ...incoming,
      items: existing.items,
      currentPage: Math.max(incoming.currentPage, existing.currentPage),
      totalProducts: Math.max(incoming.totalProducts, existing.totalProducts),
      hasMore: incoming.hasMore || existing.hasMore,
    };
  }
  if (incoming.items.length >= existing.items.length) {
    return incoming;
  }
  return {
    ...incoming,
    items: existing.items,
    currentPage: Math.max(incoming.currentPage, existing.currentPage),
    totalProducts: Math.max(incoming.totalProducts, existing.totalProducts),
    hasMore: incoming.hasMore || existing.hasMore,
  };
}

export function setCollectionState(
  key: CollectionKey,
  state: CollectionBrowseState
): void {
  const merged = mergeBrowseItems(getCollectionState(key), state);
  collectionStore.set(key, merged);
  saveToSessionStorage(key, merged);
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

export type CollectionBrowseSnapshot = Omit<CollectionBrowseState, "updatedAt">;

/**
 * Save list + page state immediately before navigating to a product page.
 * Creates an entry if none exists yet (e.g. fast tap before any other save).
 */
export function persistCollectionBrowseBeforeNavigate(
  key: CollectionKey | undefined,
  snapshot: CollectionBrowseSnapshot | null | undefined
): void {
  if (!key || !isBrowser() || !snapshot) return;
  setCollectionState(key, { ...snapshot, updatedAt: Date.now() });
}

/** Save full browse state when leaving the page (unmount), e.g. navigating to a product. */
export function saveCollectionStateOnLeave(
  key: CollectionKey,
  snapshot: CollectionBrowseSnapshot
): void {
  setCollectionState(key, { ...snapshot, updatedAt: Date.now() });
}

/** True when cached list is shorter than expected for the saved page count. */
export function isStoredBrowseListIncomplete(
  stored: CollectionBrowseState | undefined,
  pageSize = 24
): boolean {
  if (!stored || stored.currentPage < 2) return false;
  const minExpected = Math.max(1, stored.currentPage - 1) * pageSize;
  return stored.items.length < minExpected;
}
