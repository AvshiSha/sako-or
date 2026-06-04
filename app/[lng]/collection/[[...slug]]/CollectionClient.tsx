"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion as fmMotion, AnimatePresence } from "framer-motion";
import {
  FunnelIcon,
  XMarkIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";
import { Product, Category, productHelpers, VariantItem } from "@/lib/firebase";
import ProductCard from "@/app/components/ProductCard";
import { trackViewItemList } from "@/lib/dataLayer";
import { getColorName, getColorHex } from "@/lib/colors";
import { cn } from "@/lib/utils";
import ScrollToTopButton from "@/app/components/ScrollToTopButton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Slider } from '@/app/components/ui/slider';
import {
  clearCollectionState,
  getCollectionState,
  isStoredBrowseListIncomplete,
  setCollectionState,
  type CollectionBrowseSnapshot,
} from "@/lib/collectionBrowseStore";
import {
  cancelCollectionScrollRestoreWatchdog,
  COLLECTION_RETURN_EVENT,
  readLastCollectionScroll,
  resetCollectionScrollForFilterChange,
  scrollCollectionToTop,
} from "@/lib/collectionScrollRestore";
import { useCollectionScrollRestore } from "@/lib/useCollectionScrollRestore";
import { fetchCollectionPagesUpTo } from "@/lib/collectionBrowseHydration";
import { useCollectionInfiniteScroll } from "@/lib/useCollectionInfiniteScroll";
import {
  captureScrollSnapshot,
  restoreScrollAfterAppend,
} from "@/lib/preserveScrollOnAppend";
import { CollectionBrowseProvider } from "@/app/contexts/CollectionBrowseContext";
import {
  buildCollectionFilterKey,
  priceRangeToUrlParams,
  readFilterUiStateFromSearchParams,
  sameSortedStringList,
} from "@/lib/collectionFilterUrl";

// NOTE: React 19 + Next 16 typecheck currently treats `motion.*` as not accepting
// animation props in this file. We cast it to avoid a build-blocking type error.
// (Runtime behavior remains unchanged.)
const motion = fmMotion as unknown as any;

// Deterministic price formatting so server and client output matches (avoids hydration mismatch on mobile).
function formatPrice(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Stable dedupe key for product streams (non-empty id preferred, else sku). */
function productListKey(product: Product): string | null {
  const idStr =
    product.id != null && String(product.id).trim() !== ""
      ? String(product.id).trim()
      : null;
  const skuStr =
    typeof product.sku === "string" && product.sku.trim() !== ""
      ? product.sku.trim()
      : null;
  return idStr ?? skuStr;
}

function dedupeVariantItems(
  existing: VariantItem[],
  incoming: VariantItem[]
): VariantItem[] {
  const seen = new Set<string>();
  for (const item of existing) {
    const key = item.variantKey?.trim();
    if (key) seen.add(key);
  }
  const unique: VariantItem[] = [];
  for (const item of incoming) {
    const key = item.variantKey?.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function dedupeProducts(existing: Product[], incoming: Product[]): Product[] {
  const seen = new Set<string>();
  for (const item of existing) {
    const key = productListKey(item);
    if (key) seen.add(key);
  }
  const unique: Product[] = [];
  for (const item of incoming) {
    const key = productListKey(item);
    if (key === null || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

// Translations for the collection page
const translations = {
  en: {
    home: "Home",
    allProducts: "All Products",
    women: "Women",
    men: "Men",
    products: "products",
    filters: "Filters",
    relevance: "Relevance",
    priceLow: "Price: Low to High",
    priceHigh: "Price: High to Low",
    newest: "Newest",
    noProductsFound: "No products found",
    tryAdjusting: "Try adjusting your filters or search criteria.",
    loadingProducts: "Loading products...",
    loading: "Loading...",
    showing: "Showing",
    of: "of",
    items: "items",
    loadMore: "Load More",
    price: "Price",
    minPrice: "Min Price",
    maxPrice: "Max Price",
    priceRange: "Price: ₪{min} – ₪{max}",
    colors: "Colors",
    sizes: "Sizes",
    clearAllFilters: "Clear All Filters",
    applyFilters: "Apply Filters",
    subcategoriesList: {
      shoes: "Shoes",
      accessories: "Accessories",
      highheels: "High Heels",
      boots: "Boots",
      oxford: "Oxford",
      sneakers: "Sneakers",
      sandals: "Sandals",
      slippers: "Slippers",
      coats: "Coats",
      bags: "Bags"
    },
    categoriesList: {
      women: "Women",
      men: "Men",
      allProducts: "All Products"
    }
  },
  he: {
    home: "בית",
    allProducts: "כל המוצרים",
    women: "נשים",
    men: "גברים",
    products: "מוצרים",
    filters: "סינון",
    relevance: "רלוונטיות",
    priceLow: "מחיר: נמוך לגבוה",
    priceHigh: "מחיר: גבוה לנמוך",
    newest: "החדשים ביותר",
    noProductsFound: "לא נמצאו מוצרים",
    tryAdjusting: "נסו להתאים את המסננים או קריטריוני החיפוש.",
    loadingProducts: "טוען מוצרים...",
    loading: "טוען...",
    showing: "מציג",
    of: "מתוך",
    items: "מוצרים",
    loadMore: "טען עוד",
    price: "מחיר",
    minPrice: "מחיר מינימלי",
    maxPrice: "מחיר מקסימלי",
    priceRange: "מחיר: ₪{min} – ₪{max}",
    colors: "צבעים",
    sizes: "מידות",
    clearAllFilters: "נקה את כל המסננים",
    applyFilters: "החל מסננים",
    subcategoriesList: {
      shoes: "נעליים",
      accessories: "אביזרים",
      highheels: "עקבים גבוהים",
      boots: "מגפיים",
      oxford: "אוקספורד",
      sneakers: "סניקרס",
      sandals: "סנדלים",
      slippers: "נעלי בית",
      coats: "מעילים",
      bags: "תיקים"
    },
    categoriesList: {
      women: "נשים",
      men: "גברים",
      allProducts: "כל המוצרים"
    }
  }
};

interface CollectionClientProps {
  initialProducts: Product[];
  initialVariantItems?: VariantItem[]; // New: variant items (one per color variant)
  /** Stable filter options from full collection so the filter list does not collapse after selection */
  initialAvailableFilterOptions?: { colors: string[]; sizes: string[] };
  categories: Category[];
  categoryPath: string | undefined;
  selectedCategory: string;
  selectedSubcategory: string | null;
  lng: string;
  searchQuery?: string;
  searchTotal?: number;
  searchPage?: number;
  hasMore?: boolean;
  /** From server so initial state matches on static pages (e.g. women/accessories/bags) and mobile. */
  initialSort?: string;
  initialMinPrice?: string;
  initialMaxPrice?: string;
}

export default function CollectionClient({
  initialProducts,
  initialVariantItems,
  initialAvailableFilterOptions,
  categories,
  categoryPath,
  selectedCategory,
  selectedSubcategory,
  lng,
  searchQuery,
  searchTotal,
  searchPage = 1,
  hasMore: initialHasMore = false,
  initialSort: initialSortProp,
  initialMinPrice,
  initialMaxPrice,
}: CollectionClientProps) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = translations[lng as keyof typeof translations] || translations.en;

  // Determine current collection level from slug (needed early for handleLoadMore)
  const slug = params?.slug as string[] | undefined;

  // Use variantItems if available (collection pages), otherwise fall back to products (search)
  const useVariantItems = initialVariantItems !== undefined && !searchQuery;
  
  // Pagination state - accumulated variant items or products stream (never replaced, only appended)
  const [allVariantItems, setAllVariantItems] = useState<VariantItem[]>(initialVariantItems || []);
  const [allProducts, setAllProducts] = useState<Product[]>(initialProducts);
  const [currentPage, setCurrentPage] = useState(searchPage || 1);
  const [totalProducts, setTotalProducts] = useState(searchTotal ?? (useVariantItems ? (initialVariantItems?.length ?? 0) : initialProducts.length));
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Track filter/search key to detect when filters actually change (not just page)
  const filterKey = useMemo(() => {
    return buildCollectionFilterKey(searchParams ?? new URLSearchParams(), {
      categoryPath,
      searchQuery,
    });
  }, [categoryPath, searchQuery, searchParams]);

  // Stable key for this collection + filter/search combination
  const collectionKey = useMemo(() => {
    const base = `${lng}|${categoryPath || 'all'}|${searchQuery || ''}`;
    return `${base}|${filterKey}`;
  }, [lng, categoryPath, searchQuery, filterKey]);

  const serverListRevision = useMemo(() => {
    const firstVariantKey = initialVariantItems?.[0]?.variantKey ?? "";
    const firstProductKey =
      initialProducts[0]?.id != null
        ? String(initialProducts[0].id)
        : initialProducts[0]?.sku ?? "";
    return `${filterKey}|${searchTotal ?? ""}|${initialVariantItems?.length ?? 0}|${firstVariantKey}|${initialProducts.length}|${firstProductKey}`;
  }, [filterKey, searchTotal, initialVariantItems, initialProducts]);

  const prevFilterKeyRef = useRef<string>(filterKey);
  const prevServerListRevisionRef = useRef<string>(serverListRevision);
  const prevCollectionKeyRef = useRef<string>(collectionKey);
  /** After filter change, keep syncing until server props revision updates. */
  const expectingServerRefreshRef = useRef(false);
  const revisionAtFilterChangeRef = useRef<string | null>(null);
  /** Bumped when filters change so in-flight load-more responses are ignored. */
  const loadMoreEpochRef = useRef(0);
  const loadMoreAbortRef = useRef<AbortController | null>(null);
  const hydrationFallbackLoggedRef = useRef(false);
  /** Filter key we pushed via updateURL; skip URL→UI sync until router matches it. */
  const pendingFilterKeyRef = useRef<string | null>(null);
  const hydratedFromStoreRef = useRef<boolean>(false);
  const restoredFromUrlFetchRef = useRef<boolean>(false);
  const [browseListReady, setBrowseListReady] = useState(false);
  const pathname = usePathname();
  const refetchOnReturnStartedRef = useRef(false);
  const browseRefetchInProgressRef = useRef(false);
  const returningRestoreActiveRef = useRef(false);
  /** Wait until this many products are in the DOM before restoring scroll (browser Back). */
  const pendingListHydrationRef = useRef(0);

  const applyStoredBrowseState = useCallback(() => {
    if (!collectionKey) return 0;

    const stored = getCollectionState(collectionKey);
    if (!stored || !Array.isArray(stored.items) || stored.items.length === 0) {
      return 0;
    }

    hydratedFromStoreRef.current = true;
    if (stored.useVariantItems) {
      setAllVariantItems(stored.items as VariantItem[]);
    } else {
      setAllProducts(stored.items as Product[]);
    }
    setCurrentPage(stored.currentPage);
    setTotalProducts(stored.totalProducts);
    setHasMore(stored.hasMore);
    return stored.items.length;
  }, [collectionKey]);

  const isReturningFromProduct = useCallback(() => {
    const pending = readLastCollectionScroll();
    return (
      !!collectionKey &&
      pending?.browseKey === collectionKey &&
      pending.scrollY > 0
    );
  }, [collectionKey]);

  // Ref to persist latest state on unmount (navigate away to PDP)
  const stateSnapshotRef = useRef<CollectionBrowseSnapshot | null>(null);

  const finishBrowseListHydration = useCallback((expectedItemCount: number) => {
    if (expectedItemCount > 0) {
      pendingListHydrationRef.current = expectedItemCount;
      setBrowseListReady(false);
    } else {
      pendingListHydrationRef.current = 0;
      setBrowseListReady(true);
    }
  }, []);

  const collectionFetchParams = useMemo(
    () => ({
      lng,
      categoryPath,
      searchQuery,
      searchParams: searchParams ?? new URLSearchParams(),
    }),
    [lng, categoryPath, searchQuery, searchParams]
  );

  const applyHydratedPages = useCallback(
    (result: Awaited<ReturnType<typeof fetchCollectionPagesUpTo>>) => {
      if (result.count <= 0) return 0;
      hydratedFromStoreRef.current = true;
      if (result.useVariantItems) {
        setAllVariantItems(result.combined as VariantItem[]);
      } else {
        setAllProducts(result.combined as Product[]);
      }
      setCurrentPage(result.resolvedPage);
      setTotalProducts(result.total);
      setHasMore(result.hasMore);
      return result.count;
    },
    []
  );

  const refetchBrowsePagesUpTo = useCallback(
    async (targetPage: number): Promise<number> => {
      const result = await fetchCollectionPagesUpTo(
        targetPage,
        collectionFetchParams,
        useVariantItems
      );
      return applyHydratedPages(result);
    },
    [collectionFetchParams, useVariantItems, applyHydratedPages]
  );

  // Hydrate list before paint when returning from PDP (browser Back).
  useLayoutEffect(() => {
    if (!collectionKey) {
      pendingListHydrationRef.current = 0;
      setBrowseListReady(true);
      return;
    }

    const returning = isReturningFromProduct();
    if (!returning) {
      if (!hydratedFromStoreRef.current) {
        applyStoredBrowseState();
      }
      pendingListHydrationRef.current = 0;
      setBrowseListReady(true);
      return;
    }

    cancelCollectionScrollRestoreWatchdog();

    returningRestoreActiveRef.current = true;
    const stored = getCollectionState(collectionKey);
    const pagesToLoad = Math.max(stored?.currentPage ?? 1, 1);
    const needsRefetch =
      !stored?.items?.length ||
      isStoredBrowseListIncomplete(stored);

    if (stored?.items?.length) {
      applyStoredBrowseState();
    }

    if (needsRefetch && pagesToLoad >= 1 && !refetchOnReturnStartedRef.current) {
      refetchOnReturnStartedRef.current = true;
      browseRefetchInProgressRef.current = true;
      setBrowseListReady(false);
      void refetchBrowsePagesUpTo(pagesToLoad)
        .then((count) => {
          if (count > 0) {
            hydratedFromStoreRef.current = true;
          } else if (stored?.items?.length) {
            applyStoredBrowseState();
          }
        })
        .catch((error) => {
          console.error("[collection] refetch on browser back failed:", error);
          if (stored?.items?.length) {
            applyStoredBrowseState();
          }
        })
        .finally(() => {
          browseRefetchInProgressRef.current = false;
          pendingListHydrationRef.current = 0;
          setBrowseListReady(true);
        });
      return;
    }

    if (stored?.items?.length) {
      finishBrowseListHydration(stored.items.length);
      return;
    }

    finishBrowseListHydration(0);
  }, [
    collectionKey,
    pathname,
    searchParams,
    applyStoredBrowseState,
    isReturningFromProduct,
    finishBrowseListHydration,
    refetchBrowsePagesUpTo,
  ]);

  // Release scroll restore before paint once the full list is in state.
  useLayoutEffect(() => {
    if (pendingListHydrationRef.current <= 0) return;
    const count = useVariantItems ? allVariantItems.length : allProducts.length;
    if (count >= pendingListHydrationRef.current) {
      pendingListHydrationRef.current = 0;
      setBrowseListReady(true);
    }
  }, [allVariantItems.length, allProducts.length, useVariantItems]);

  // Safety: if hydration count stalls, re-apply cache or refetch missing pages.
  useEffect(() => {
    if (!isReturningFromProduct()) return;
    if (pendingListHydrationRef.current <= 0 && !browseRefetchInProgressRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      if (!hydrationFallbackLoggedRef.current) {
        hydrationFallbackLoggedRef.current = true;
        console.warn("[collection] browse hydration fallback fired");
      }
      if (browseRefetchInProgressRef.current) {
        const stored = getCollectionState(collectionKey);
        const pages = Math.max(stored?.currentPage ?? 1, 1);
        void refetchBrowsePagesUpTo(pages).finally(() => {
          browseRefetchInProgressRef.current = false;
          pendingListHydrationRef.current = 0;
          setBrowseListReady(true);
        });
        return;
      }

      if (pendingListHydrationRef.current <= 0) return;

      const stored = getCollectionState(collectionKey);
      const count = useVariantItems ? allVariantItems.length : allProducts.length;
      const expected = pendingListHydrationRef.current;

      if (stored?.items?.length && count < expected) {
        applyStoredBrowseState();
      }

      if (
        count < expected &&
        !refetchOnReturnStartedRef.current &&
        (stored?.currentPage ?? 1) >= 2
      ) {
        refetchOnReturnStartedRef.current = true;
        browseRefetchInProgressRef.current = true;
        void refetchBrowsePagesUpTo(stored?.currentPage ?? 2).finally(() => {
          browseRefetchInProgressRef.current = false;
          pendingListHydrationRef.current = 0;
          setBrowseListReady(true);
        });
        return;
      }

      pendingListHydrationRef.current = 0;
      setBrowseListReady(true);
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [
    collectionKey,
    pathname,
    isReturningFromProduct,
    useVariantItems,
    allVariantItems.length,
    allProducts.length,
    applyStoredBrowseState,
    refetchBrowsePagesUpTo,
  ]);

  useEffect(() => {
    if (!browseListReady || !returningRestoreActiveRef.current) return;
    returningRestoreActiveRef.current = false;
  }, [browseListReady]);

  // RSC may reset the client to page-1 props on Back — re-apply stored list if shorter (before paint).
  useLayoutEffect(() => {
    if (!isReturningFromProduct()) return;
    const stored = getCollectionState(collectionKey);
    if (!stored?.items?.length) return;

    const currentLen = useVariantItems ? allVariantItems.length : allProducts.length;
    if (currentLen < stored.items.length) {
      const expectedCount = applyStoredBrowseState();
      finishBrowseListHydration(expectedCount);
    }
  }, [
    pathname,
    collectionKey,
    initialVariantItems,
    initialProducts,
    allVariantItems.length,
    allProducts.length,
    useVariantItems,
    applyStoredBrowseState,
    isReturningFromProduct,
    finishBrowseListHydration,
  ]);

  useEffect(() => {
    const onBrowseReturn = () => {
      if (!isReturningFromProduct()) return;
      const stored = getCollectionState(collectionKey);
      if (!stored?.items?.length) return;

      const currentLen = useVariantItems
        ? allVariantItems.length
        : allProducts.length;
      if (currentLen >= stored.items.length) return;

      cancelCollectionScrollRestoreWatchdog();
      const expectedCount = applyStoredBrowseState();
      if (expectedCount > 0) {
        finishBrowseListHydration(expectedCount);
      }
    };

    window.addEventListener(COLLECTION_RETURN_EVENT, onBrowseReturn);
    return () =>
      window.removeEventListener(COLLECTION_RETURN_EVENT, onBrowseReturn);
  }, [
    collectionKey,
    applyStoredBrowseState,
    isReturningFromProduct,
    finishBrowseListHydration,
    useVariantItems,
    allVariantItems.length,
    allProducts.length,
  ]);

  // Deep-link bootstrap: ?page=N without browse cache fetches pages 1..N sequentially once.
  useEffect(() => {
    if (!collectionKey || hydratedFromStoreRef.current || restoredFromUrlFetchRef.current) {
      return;
    }

    const pageParam = searchParams?.get("page");
    const targetPage = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
    if (targetPage < 2) return;

    restoredFromUrlFetchRef.current = true;
    setBrowseListReady(false);

    void fetchCollectionPagesUpTo(
      targetPage,
      collectionFetchParams,
      useVariantItems
    )
      .then((result) => {
        applyHydratedPages(result);
      })
      .catch(() => {
        restoredFromUrlFetchRef.current = false;
      })
      .finally(() => {
        setBrowseListReady(true);
      });
  }, [
    collectionKey,
    collectionFetchParams,
    useVariantItems,
    searchParams,
    applyHydratedPages,
  ]);

  // Sync list from server when filters/search change or fresh RSC props arrive.
  // Skip when browse cache hydration is active (PDP back). Do not wipe load-more
  // accumulation on page-only URL changes.
  // Intentionally omits allVariantItems/allProducts length from deps: this effect
  // updates those lists, so length deps would re-fire after every sync (and after
  // load-more). accumulatedBeyondInitial is read once per filterKey/revision run.
  useEffect(() => {
    if (
      pendingListHydrationRef.current > 0 ||
      browseRefetchInProgressRef.current ||
      (returningRestoreActiveRef.current && prevFilterKeyRef.current === filterKey)
    ) {
      return;
    }

    const filterChanged = prevFilterKeyRef.current !== filterKey;
    const serverDataChanged =
      prevServerListRevisionRef.current !== serverListRevision;

    if (filterChanged) {
      if (
        prevCollectionKeyRef.current &&
        prevCollectionKeyRef.current !== collectionKey
      ) {
        clearCollectionState(prevCollectionKeyRef.current);
      }

      revisionAtFilterChangeRef.current = serverListRevision;
      prevFilterKeyRef.current = filterKey;
      prevCollectionKeyRef.current = collectionKey;
      hydratedFromStoreRef.current = false;
      expectingServerRefreshRef.current = true;

      loadMoreAbortRef.current?.abort();
      loadMoreAbortRef.current = null;
      loadMoreEpochRef.current += 1;
      setIsLoadingMore(false);

      resetCollectionScrollForFilterChange();
      scrollCollectionToTop();
    }

    if (hydratedFromStoreRef.current) {
      if (serverDataChanged) {
        prevServerListRevisionRef.current = serverListRevision;
      }
      return;
    }

    const initialCount = useVariantItems
      ? (initialVariantItems?.length ?? 0)
      : initialProducts.length;
    const accumulatedCount = useVariantItems
      ? allVariantItems.length
      : allProducts.length;
    const accumulatedBeyondInitial = accumulatedCount > initialCount;

    const awaitingFreshServer =
      expectingServerRefreshRef.current &&
      revisionAtFilterChangeRef.current !== null &&
      serverListRevision !== revisionAtFilterChangeRef.current;

    const shouldSyncFromServer =
      filterChanged ||
      awaitingFreshServer ||
      (serverDataChanged && !accumulatedBeyondInitial);

    if (!shouldSyncFromServer) {
      if (serverDataChanged) {
        prevServerListRevisionRef.current = serverListRevision;
      }
      return;
    }

    if (useVariantItems && initialVariantItems) {
      setAllVariantItems(initialVariantItems);
      setTotalProducts(searchTotal ?? initialVariantItems.length);
    } else {
      setAllProducts(initialProducts);
      setTotalProducts(searchTotal ?? initialProducts.length);
    }
    setCurrentPage(searchPage || 1);
    setHasMore(initialHasMore);
    if (awaitingFreshServer) {
      expectingServerRefreshRef.current = false;
      revisionAtFilterChangeRef.current = null;
    } else if (filterChanged) {
      expectingServerRefreshRef.current = true;
    }
    prevServerListRevisionRef.current = serverListRevision;

    const stored = getCollectionState(collectionKey);
    if (stored) {
      setCollectionState(collectionKey, {
        ...stored,
        items: useVariantItems
          ? (initialVariantItems ?? [])
          : initialProducts,
        useVariantItems,
        currentPage: searchPage || 1,
        totalProducts: searchTotal ?? stored.totalProducts,
        hasMore: initialHasMore,
        scrollY: 0,
        anchorVariantKey: undefined,
        updatedAt: Date.now(),
      });
    }
  }, [
    filterKey,
    serverListRevision,
    searchPage,
    searchTotal,
    initialHasMore,
    useVariantItems,
    collectionKey,
  ]);

  // Keep snapshot ref updated so we can persist on unmount
  stateSnapshotRef.current = {
    useVariantItems,
    items: useVariantItems ? allVariantItems : allProducts,
    currentPage,
    totalProducts,
    hasMore,
  };

  // Load More handler
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    const epochAtStart = loadMoreEpochRef.current;
    const snapshot = captureScrollSnapshot();
    loadMoreAbortRef.current?.abort();
    const abortController = new AbortController();
    loadMoreAbortRef.current = abortController;
    try {
      const nextPage = currentPage + 1;
      
      // Build API URL with all current filters
      const apiUrl = new URL('/api/products/collection', window.location.origin);
      apiUrl.searchParams.set('page', nextPage.toString());
      apiUrl.searchParams.set('language', lng);
      
      if (categoryPath) {
        apiUrl.searchParams.set('categoryPath', categoryPath);
      }
      
      if (searchQuery) {
        apiUrl.searchParams.set('search', searchQuery);
      }

      // Add all current filter params
      const safeSearchParams = searchParams ?? new URLSearchParams();
      safeSearchParams.forEach((value, key) => {
        if (key !== 'page' && key !== 'search') {
          apiUrl.searchParams.set(key, value);
        }
      });

      const response = await fetch(apiUrl.toString(), {
        signal: abortController.signal,
      });
      if (!response.ok) {
        throw new Error('Failed to load more products');
      }

      const data = await response.json();

      if (
        epochAtStart !== loadMoreEpochRef.current ||
        abortController.signal.aborted
      ) {
        return;
      }

      const resolvedPage = data.page || nextPage;

      // Handle variantItems (collection pages) or items (search)
      if (useVariantItems && data.variantItems) {
        const newVariantItems = data.variantItems || [];
        
        if (newVariantItems.length === 0) {
          setHasMore(false);
          setIsLoadingMore(false);
          return;
        }

        let appended = false;
        flushSync(() => {
          setAllVariantItems((prev) => {
            const uniqueNewItems = dedupeVariantItems(prev, newVariantItems);
            if (uniqueNewItems.length === 0) {
              console.warn(
                "All fetched variant items were duplicates, skipping append"
              );
              return prev;
            }
            appended = true;
            return [...prev, ...uniqueNewItems];
          });
          setCurrentPage(resolvedPage);
          setTotalProducts(data.total || totalProducts);
          setHasMore(data.hasMore || false);
          setIsLoadingMore(false);
        });
        if (appended) {
          restoreScrollAfterAppend(snapshot);
        }
      } else {
        const newItems = data.items || [];
        
        if (newItems.length === 0) {
          setHasMore(false);
          setIsLoadingMore(false);
          return;
        }

        let appended = false;
        flushSync(() => {
          setAllProducts((prev) => {
            const uniqueNewItems = dedupeProducts(prev, newItems);
            if (uniqueNewItems.length === 0) {
              console.warn(
                "All fetched items were duplicates, skipping append"
              );
              return prev;
            }
            appended = true;
            return [...prev, ...uniqueNewItems];
          });
          setCurrentPage(resolvedPage);
          setTotalProducts(data.total || totalProducts);
          setHasMore(data.hasMore || false);
          setIsLoadingMore(false);
        });
        if (appended) {
          restoreScrollAfterAppend(snapshot);
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error('Error loading more products:', error);
    } finally {
      if (loadMoreAbortRef.current === abortController) {
        loadMoreAbortRef.current = null;
      }
      setIsLoadingMore(false);
    }
  }, [
    isLoadingMore,
    hasMore,
    currentPage,
    categoryPath,
    searchQuery,
    lng,
    searchParams,
    totalProducts,
    useVariantItems,
  ]);

  const { sentinelRef: loadMoreSentinelRef } = useCollectionInfiniteScroll({
    hasMore,
    browseListReady,
    isLoadingMore,
    onLoadMore: handleLoadMore,
    resetKey: collectionKey,
  });

  const collectionLevel = slug ? slug.length : 0; // 0 = all/main, 1 = level 0, 2 = level 1, 3+ = level 2+
  const showSubSubCategoryFilter = collectionLevel <= 2; // Show only on level 0 and level 1 pages

  // Helper function to get translated category/subcategory name
  const getTranslatedName = (category: string | undefined, subcategory?: string | null) => {
    // If search query exists, show search results title instead
    if (searchQuery) {
      return '';
    }

    if (subcategory) {
      const subCategoryCapitalized = subcategory.charAt(0).toUpperCase() + subcategory.slice(1);
      return subCategoryCapitalized;
    }

    if (!category) {
      return lng === 'he' ? 'כל המוצרים' : 'All Products';
    }

    if (category === 'women') {
      return 'Women';
    }
    if (category === 'men') {
      return 'Men';
    }
    const categoryKey = category.toLowerCase();
    const translatedCategory = t.categoriesList[categoryKey as keyof typeof t.categoriesList];
    return translatedCategory || category.charAt(0).toUpperCase() + category.slice(1);
  };

  // Initialize filter state from URL searchParams
  const safeSearchParams = searchParams ?? new URLSearchParams();

  const [selectedColors, setSelectedColors] = useState<string[]>(() => {
    const colorsParam = safeSearchParams.get('colors');
    return colorsParam ? colorsParam.split(',').filter(Boolean) : [];
  });

  const [selectedSizes, setSelectedSizes] = useState<string[]>(() => {
    const sizesParam = safeSearchParams.get('sizes');
    return sizesParam ? sizesParam.split(',').filter(Boolean) : [];
  });

  // Add state for selected sub-sub categories
  const [selectedSubSubCategories, setSelectedSubSubCategories] = useState<string[]>(() => {
    const subSubCategoriesParam = safeSearchParams.get('subSubCategories');
    return subSubCategoriesParam ? subSubCategoriesParam.split(',').filter(Boolean) : [];
  });

  const [sortBy, setSortBy] = useState<string>(() => {
    return initialSortProp ?? 'relevance';
  });

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);
  
  // Controlled state for accordion sections (desktop and mobile)
  // Using array to allow multiple sections open simultaneously
  const [desktopAccordionValue, setDesktopAccordionValue] = useState<string[]>([]);
  const [mobileAccordionValue, setMobileAccordionValue] = useState<string[]>([]);

  // Auto-open accordion sections that have active filters when filter panel opens

  // Update URL when filters change
  const updateURL = (newFilters: {
    colors?: string[];
    sizes?: string[];
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    subSubCategories?: string[];
  }, resetPage: boolean = true) => {
    // Start with current search params to preserve search query
    const urlParams = new URLSearchParams(safeSearchParams.toString());
    
    // Reset page to 1 when filters change (user expects to see filtered results from start)
    if (resetPage) {
      urlParams.delete('page');
    }
    
    // Remove filter params that we're about to update (so we can reset them)
    urlParams.delete('colors');
    urlParams.delete('sizes');
    urlParams.delete('minPrice');
    urlParams.delete('maxPrice');
    urlParams.delete('sort');
    urlParams.delete('subSubCategories');
    
    // Add back only the filter params that have values
    if (newFilters.colors && newFilters.colors.length > 0) {
      urlParams.set('colors', newFilters.colors.join(','));
    }
    if (newFilters.sizes && newFilters.sizes.length > 0) {
      urlParams.set('sizes', newFilters.sizes.join(','));
    }
    if (newFilters.subSubCategories && newFilters.subSubCategories.length > 0) {
      urlParams.set('subSubCategories', newFilters.subSubCategories.join(','));
    }
    // Explicitly handle price params - if they're provided (even as empty string), set or remove them
    if (newFilters.minPrice !== undefined) {
      if (newFilters.minPrice && newFilters.minPrice.trim() !== '') {
        urlParams.set('minPrice', newFilters.minPrice);
      }
      // If empty string, don't set it (it will be removed from URL)
    }
    if (newFilters.maxPrice !== undefined) {
      if (newFilters.maxPrice && newFilters.maxPrice.trim() !== '') {
        urlParams.set('maxPrice', newFilters.maxPrice);
      }
      // If empty string, don't set it (it will be removed from URL)
    }
    if (newFilters.sort && newFilters.sort !== 'relevance') {
      urlParams.set('sort', newFilters.sort);
    }
    
    const queryString = urlParams.toString();
    const currentPath = `/${lng}/collection${slug ? '/' + slug.join('/') : ''}`;
    const newUrl = queryString ? `${currentPath}?${queryString}` : currentPath;

    pendingFilterKeyRef.current = buildCollectionFilterKey(urlParams, {
      categoryPath,
      searchQuery,
    });

    resetCollectionScrollForFilterChange();
    scrollCollectionToTop();
    router.push(newUrl, { scroll: false });
    requestAnimationFrame(() => scrollCollectionToTop());
  };

  // Handle filter changes
  const handleColorToggle = (color: string) => {
    const newColors = selectedColors.includes(color)
      ? selectedColors.filter((c) => c !== color)
      : [...selectedColors, color];
    setSelectedColors(newColors);
    const { minPrice, maxPrice } = priceRangeToUrlParams(
      uiRange,
      collectionPriceBounds
    );
    updateURL({ 
      minPrice, 
      maxPrice, 
      colors: newColors, 
      sizes: selectedSizes, 
      sort: sortBy,
      subSubCategories: selectedSubSubCategories
    });
  };

  const handleSizeToggle = (size: string) => {
    const newSizes = selectedSizes.includes(size)
      ? selectedSizes.filter((s) => s !== size)
      : [...selectedSizes, size];
    setSelectedSizes(newSizes);
    const { minPrice, maxPrice } = priceRangeToUrlParams(
      uiRange,
      collectionPriceBounds
    );
    updateURL({ 
      minPrice, 
      maxPrice, 
      colors: selectedColors, 
      sizes: newSizes, 
      sort: sortBy,
      subSubCategories: selectedSubSubCategories
    });
  };

  // Handle sub-sub category toggle
  const handleSubSubCategoryToggle = (categoryId: string) => {
    const newSubSubCategories = selectedSubSubCategories.includes(categoryId)
      ? selectedSubSubCategories.filter((id) => id !== categoryId)
      : [...selectedSubSubCategories, categoryId];
    setSelectedSubSubCategories(newSubSubCategories);
    const { minPrice, maxPrice } = priceRangeToUrlParams(
      uiRange,
      collectionPriceBounds
    );
    updateURL({ 
      minPrice, 
      maxPrice, 
      colors: selectedColors, 
      sizes: selectedSizes, 
      sort: sortBy,
      subSubCategories: newSubSubCategories
    });
  };

  // LIVE UI: Update slider and label instantly while dragging (no URL update)
  const handleSliderChange = (values: number[]) => {
    const [min, max] = values;
    
    // Only ensure min <= max (do NOT clamp to collection bounds)
    // Allow user to set values outside collection range
    const validatedMin = Math.min(min, max);
    const validatedMax = Math.max(min, max);
    
    // Update UI state immediately (slider moves smoothly)
    setUiRange([validatedMin, validatedMax]);
  };

  // COMMIT: Update URL when user releases slider (only place URL is updated)
  const handleSliderCommit = (values: number[]) => {
    const [min, max] = values as [number, number];
    
    // Only ensure min <= max (do NOT clamp to collection bounds)
    // Allow user to set values outside collection range
    const finalRange: [number, number] = [
      Math.min(min, max),
      Math.max(min, max),
    ];
    
    // Update UI state to final range
    setUiRange(finalRange);
    
    const { minPrice, maxPrice } = priceRangeToUrlParams(
      finalRange,
      collectionPriceBounds
    );
    
    updateURL({
      minPrice,
      maxPrice,
      colors: selectedColors,
      sizes: selectedSizes,
      sort: sortBy,
      subSubCategories: selectedSubSubCategories,
    });
  };

  // Reset: Immediately commit full bounds to URL
  const handlePriceReset = () => {
    const boundsMin = collectionPriceBounds?.min ?? 0;
    const boundsMax = collectionPriceBounds?.max ?? 1000;
    const full: [number, number] = [boundsMin, boundsMax];
    
    // Update UI immediately
    setUiRange(full);
    
    updateURL({
      minPrice: "",
      maxPrice: "",
      colors: selectedColors,
      sizes: selectedSizes,
      sort: sortBy,
      subSubCategories: selectedSubSubCategories,
    });
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    const { minPrice, maxPrice } = priceRangeToUrlParams(
      uiRange,
      collectionPriceBounds
    );
    updateURL({ 
      minPrice, 
      maxPrice, 
      colors: selectedColors, 
      sizes: selectedSizes, 
      sort: newSort,
      subSubCategories: selectedSubSubCategories
    });
  };

  const handleClearFilters = () => {
    setSelectedColors([]);
    setSelectedSizes([]);
    setSelectedSubSubCategories([]);
    setSortBy('relevance');
    
    const boundsMin = collectionPriceBounds?.min ?? 0;
    const boundsMax = collectionPriceBounds?.max ?? 1000;
    const full: [number, number] = [boundsMin, boundsMax];
    
    // Update UI immediately
    setUiRange(full);
    
    // Clear all filters in URL
    updateURL({ 
      minPrice: '', 
      maxPrice: '', 
      colors: [], 
      sizes: [], 
      sort: 'relevance',
      subSubCategories: []
    });
  };


  // Apply sorting to variant items or products (items are already filtered server-side)
  const sortedItems = useMemo(() => {
    if (useVariantItems) {
      // Sort variant items
      const sorted = [...allVariantItems].sort((a, b) => {
        // Get variant-specific price for comparison
        const getVariantPrice = (item: VariantItem): number => {
          if (item.variant.salePrice && item.variant.salePrice > 0) return item.variant.salePrice;
          if (item.product.salePrice && item.product.salePrice > 0) return item.product.salePrice;
          if (item.variant.priceOverride && item.variant.priceOverride > 0) return item.variant.priceOverride;
          return item.product.price;
        };
        
        switch (sortBy) {
          case "price-low":
            return getVariantPrice(a) - getVariantPrice(b);
          case "price-high":
            return getVariantPrice(b) - getVariantPrice(a);
          case "newest":
            // Sort by product createdAt (all variants of same product have same date)
            const dateA = a.product.createdAt ? new Date(a.product.createdAt).getTime() : 0;
            const dateB = b.product.createdAt ? new Date(b.product.createdAt).getTime() : 0;
            return dateB - dateA; // Newest first
          case "relevance":
          default:
            // Keep server-side order (already sorted by createdAt desc)
            return 0;
        }
      });
      return sorted;
    } else {
      // Sort products (for search)
      const sorted = [...allProducts].sort((a, b) => {
        const priceA = (a.salePrice && a.salePrice > 0) ? a.salePrice : a.price;
        const priceB = (b.salePrice && b.salePrice > 0) ? b.salePrice : b.price;
        
        switch (sortBy) {
          case "price-low":
            return priceA - priceB;
          case "price-high":
            return priceB - priceA;
          case "newest":
            if (a.createdAt && b.createdAt) {
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            const aId = typeof a.id === 'string' ? parseInt(a.id) : (typeof a.id === 'number' ? a.id : 0);
            const bId = typeof b.id === 'string' ? parseInt(b.id) : (typeof b.id === 'number' ? b.id : 0);
            return bId - aId;
          case "relevance":
          default:
            return 0;
        }
      });
      return sorted;
    }
  }, [allVariantItems, allProducts, sortBy, useVariantItems]);

  useCollectionScrollRestore({
    browseKey: collectionKey,
    itemCount: sortedItems.length,
    snapshotRef: stateSnapshotRef,
    browseListReady,
    persistDeps: [
      useVariantItems,
      allVariantItems.length,
      allProducts.length,
      currentPage,
      totalProducts,
      hasMore,
    ],
  });

  // Track view_item_list when items are displayed
  useEffect(() => {
    if (sortedItems.length === 0) return;

    try {
      const listName = categoryPath || selectedCategory || 'All Products';
      const listId = categoryPath || selectedCategory || 'all_products';
      
      const items = useVariantItems
        ? (sortedItems as VariantItem[]).map((item) => {
            // Track each variant item separately
            const price = item.variant.salePrice || item.product.salePrice || item.variant.priceOverride || item.product.price;
            const productName = productHelpers.getField(item.product, 'name', lng as 'en' | 'he') || item.product.title_en || item.product.title_he || 'Unknown Product';
            const categories = item.product.categories_path || [item.product.category || 'Unknown'];
            
            return {
              name: productName,
              id: `${item.product.sku || item.product.id || ''}-${item.variant.colorSlug}`,
              price: price,
              brand: item.product.brand,
              categories: categories,
              variant: item.variant.colorSlug
            };
          })
        : (sortedItems as Product[]).map((product) => {
            // Track products (for search)
            const firstVariant = product.colorVariants 
              ? Object.values(product.colorVariants).find(v => v.isActive !== false)
              : null;
            
            const price = firstVariant?.salePrice || firstVariant?.priceOverride || product.salePrice || product.price;
            const variant = firstVariant?.colorSlug || '';
            const productName = productHelpers.getField(product, 'name', lng as 'en' | 'he') || product.title_en || product.title_he || 'Unknown Product';
            const categories = product.categories_path || [product.category || 'Unknown'];
            
            return {
              name: productName,
              id: product.sku || product.id || '',
              price: price,
              brand: product.brand,
              categories: categories,
              variant: variant
            };
          });

      trackViewItemList(items, listName, listId, 'ILS');
    } catch (dataLayerError) {
      console.warn('Data layer tracking error:', dataLayerError);
    }
  }, [sortedItems, categoryPath, selectedCategory, lng, useVariantItems]);

  // Filter options: use stable full-collection options when provided so list does not collapse after selection
  const allColors = useMemo(() => {
    if (initialAvailableFilterOptions?.colors?.length) {
      return initialAvailableFilterOptions.colors;
    }
    if (useVariantItems && initialVariantItems) {
      return [
        ...new Set(
          initialVariantItems
            .filter(item => item.variant.isActive !== false && item.variant.colorSlug)
            .map(item => item.variant.colorSlug)
            .filter(Boolean)
        ),
      ] as string[];
    }
    return [
      ...new Set([
        ...initialProducts.flatMap((p) =>
          p.colorVariants
            ? Object.values(p.colorVariants)
                .filter(v => v.isActive !== false)
                .map((v) => v.colorSlug)
                .filter(Boolean)
            : []
        ),
      ]),
    ] as string[];
  }, [initialProducts, initialVariantItems, useVariantItems, initialAvailableFilterOptions]);

  const allSizes = useMemo(() => {
    if (initialAvailableFilterOptions?.sizes?.length) {
      return initialAvailableFilterOptions.sizes;
    }
    if (useVariantItems && initialVariantItems) {
      return [
        ...new Set(
          initialVariantItems
            .filter(item => item.variant.isActive !== false)
            .flatMap((item) => Object.keys(item.variant.stockBySize || {}))
        ),
      ] as string[];
    }
    return [
      ...new Set([
        ...initialProducts.flatMap((p) =>
          p.colorVariants
            ? Object.values(p.colorVariants)
                .filter(v => v.isActive !== false)
                .flatMap((v) => Object.keys(v.stockBySize || {}))
            : []
        ),
      ]),
    ] as string[];
  }, [initialProducts, initialVariantItems, useVariantItems, initialAvailableFilterOptions]);

  // Build color slug to hex for swatches; ensure every color in allColors has an entry
  const colorSlugToHex = useMemo(() => {
    const map: Record<string, string> = {};
    if (useVariantItems && initialVariantItems) {
      initialVariantItems.forEach((item) => {
        if (item.variant.isActive !== false && item.variant.colorSlug) {
          map[item.variant.colorSlug] = (item.variant as any).colorHex || getColorHex(item.variant.colorSlug);
        }
      });
    } else {
      initialProducts.forEach((product) => {
        if (product.colorVariants) {
          Object.values(product.colorVariants).forEach((variant) => {
            if (variant.isActive !== false && variant.colorSlug) {
              map[variant.colorSlug] = (variant as any).colorHex || getColorHex(variant.colorSlug);
            }
          });
        }
      });
    }
    allColors.forEach((c) => {
      if (!map[c]) map[c] = getColorHex(c);
    });
    return map;
  }, [initialProducts, initialVariantItems, useVariantItems, allColors]);

  // Separate numeric sizes (shoes) from alpha sizes (clothing)
  const numericSizes = allSizes.filter(size => /^\d+(\.\d+)?$/.test(size)).sort((a, b) => parseFloat(a) - parseFloat(b));
  const alphaSizes = allSizes.filter(size => !/^\d+(\.\d+)?$/.test(size)).sort();

  // Get all sub-sub categories (level 2) grouped by parent
  const subSubCategoriesByParent = useMemo(() => {
    const grouped: Record<string, Category[]> = {};

    const pathRootSegment =
      typeof categoryPath === 'string' ? categoryPath.split('/').filter(Boolean)[0]?.trim() ?? '' : '';
    const rootSlugSource =
      (typeof selectedCategory === 'string' ? selectedCategory.trim() : '') || pathRootSegment;
    const subSlugSource =
      selectedSubcategory != null && typeof selectedSubcategory === 'string'
        ? selectedSubcategory.trim()
        : '';

    const findRootCategory = (rootSlug: string) => {
      const normalized = rootSlug.toLowerCase();
      return categories.find((cat) => {
        if (cat.level !== 0 || !cat.isEnabled) return false;
        const slugEn = typeof cat.slug === 'object' ? cat.slug.en : cat.slug;
        const slugHe = typeof cat.slug === 'object' ? cat.slug.he : cat.slug;
        return slugEn?.toLowerCase() === normalized || slugHe?.toLowerCase() === normalized;
      });
    };

    // On subcategory pages (e.g. /collection/women/shoes), scope to that subcategory
    let currentSubcategoryId: string | undefined;
    if (collectionLevel === 2 && rootSlugSource.length > 0 && subSlugSource.length > 0) {
      const root = findRootCategory(rootSlugSource);
      const subcategorySlug = subSlugSource.toLowerCase();
      const foundSubcategory = categories.find((cat) => {
        if (cat.level !== 1 || !cat.isEnabled || !root?.id || cat.parentId !== root.id) return false;
        const slugEn = typeof cat.slug === 'object' ? cat.slug.en : cat.slug;
        const slugHe = typeof cat.slug === 'object' ? cat.slug.he : cat.slug;
        const slugLang =
          typeof cat.slug === 'object'
            ? (lng === 'he' ? cat.slug.he : cat.slug.en) || cat.slug.en
            : cat.slug;
        return (
          slugEn?.toLowerCase() === subcategorySlug ||
          slugHe?.toLowerCase() === subcategorySlug ||
          slugLang?.toLowerCase() === subcategorySlug
        );
      });
      currentSubcategoryId = foundSubcategory?.id;
    }

    // Get all sub-sub categories (level 2) that are enabled
    let subSubCategories = categories.filter(
      (cat) => cat.level === 2 && cat.isEnabled && cat.id
    );

    if (collectionLevel === 2 && currentSubcategoryId) {
      subSubCategories = subSubCategories.filter((cat) => cat.parentId === currentSubcategoryId);
    } else if (collectionLevel === 1 && rootSlugSource.length > 0) {
      // On root category pages (e.g. /collection/women), only sub-subcategories under that root
      const root = findRootCategory(rootSlugSource);
      if (root?.id) {
        const level1ParentIds = new Set(
          categories
            .filter((cat) => cat.level === 1 && cat.isEnabled && cat.parentId === root.id && cat.id)
            .map((cat) => cat.id!)
        );
        subSubCategories = subSubCategories.filter(
          (cat) => cat.parentId != null && level1ParentIds.has(cat.parentId)
        );
      }
    }
    
    // Group by parent category
    subSubCategories.forEach(cat => {
      if (cat.parentId) {
        if (!grouped[cat.parentId]) {
          grouped[cat.parentId] = [];
        }
        grouped[cat.parentId].push(cat);
      }
    });
    
    // Sort each group by sortOrder
    Object.keys(grouped).forEach(parentId => {
      grouped[parentId].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    });
    
    return grouped;
  }, [categories, collectionLevel, selectedSubcategory, selectedCategory, categoryPath, lng]);

  // Get parent category name for display
  const getParentCategoryName = (parentId: string): string => {
    const parent = categories.find(cat => cat.id === parentId);
    if (!parent) return '';
    return lng === 'he' ? parent.name.he : parent.name.en;
  };

  // Get sub-sub category name based on language
  const getSubSubCategoryName = (category: Category): string => {
    return lng === 'he' ? category.name.he : category.name.en;
  };

  // STATIC: Collection Price Bounds - calculated from ALL variant items or products in collection
  // These represent the full available range and NEVER change when user drags slider
  const collectionPriceBounds = useMemo(() => {
    const prices: number[] = [];
    
    if (useVariantItems && initialVariantItems) {
      // Calculate from variant items
      if (initialVariantItems.length === 0) {
        return { min: 0, max: 1000 };
      }
      
      initialVariantItems.forEach((item) => {
        if (item.variant.isActive !== false) {
          // Priority: variant.salePrice > product.salePrice > variant.priceOverride > product.price
          if (item.variant.salePrice && item.variant.salePrice > 0) {
            prices.push(item.variant.salePrice);
          } else if (item.product.salePrice && item.product.salePrice > 0) {
            prices.push(item.product.salePrice);
          } else if (item.variant.priceOverride && item.variant.priceOverride > 0) {
            prices.push(item.variant.priceOverride);
          } else {
            prices.push(item.product.price);
          }
        }
      });
    } else {
      // Calculate from products (for search)
      if (initialProducts.length === 0) {
        return { min: 0, max: 1000 };
      }

      initialProducts.forEach((product) => {
        if (product.colorVariants && Object.keys(product.colorVariants).length > 0) {
          // Get prices from all active variants
          Object.values(product.colorVariants)
            .filter(v => v.isActive !== false)
            .forEach((variant) => {
              // Priority: variant.salePrice > product.salePrice > variant.priceOverride > product.price
              if ((variant as any).salePrice && (variant as any).salePrice > 0) {
                prices.push((variant as any).salePrice);
              } else if (product.salePrice && product.salePrice > 0) {
                prices.push(product.salePrice);
              } else if ((variant as any).priceOverride && (variant as any).priceOverride > 0) {
                prices.push((variant as any).priceOverride);
              } else {
                prices.push(product.price);
              }
            });
        } else {
          // No variants, use product-level price
          const productPrice = product.salePrice && product.salePrice > 0 ? product.salePrice : product.price;
          prices.push(productPrice);
        }
      });
    }

    if (prices.length === 0) {
      return { min: 0, max: 1000 };
    }

    const min = Math.floor(Math.min(...prices));
    const max = Math.ceil(Math.max(...prices));
    
    // Round to nice numbers
    const minRounded = Math.floor(min / 10) * 10;
    const maxRounded = Math.ceil(max / 10) * 10;
    
    return { min: minRounded, max: maxRounded };
  }, [initialProducts, initialVariantItems, useVariantItems]);

  // UI State: Live price range for slider. Initialize from server-passed params so static pages (e.g. women/accessories/bags) match on mobile.
  const [uiRange, setUiRange] = useState<[number, number]>(() => {
    const boundsMin = collectionPriceBounds?.min ?? 0;
    const boundsMax = collectionPriceBounds?.max ?? 1000;
    const urlMin =
      initialMinPrice != null && initialMinPrice !== "" ? parseFloat(initialMinPrice) : boundsMin;
    const urlMax =
      initialMaxPrice != null && initialMaxPrice !== "" ? parseFloat(initialMaxPrice) : boundsMax;
    const validMin = isNaN(urlMin) ? boundsMin : urlMin;
    const validMax = isNaN(urlMax) ? boundsMax : urlMax;
    return [Math.min(validMin, validMax), Math.max(validMin, validMax)];
  });

  // Re-initialize uiRange when collectionPriceBounds becomes available (if it was undefined during initial render).
  // Use server-provided initialMinPrice/initialMaxPrice (same as useState initializer) to avoid hydration mismatch on static pages.
  useEffect(() => {
    if (!collectionPriceBounds) return; // Wait for bounds to be computed
    if (pendingFilterKeyRef.current !== null) return;

    const boundsMin = collectionPriceBounds.min;
    const boundsMax = collectionPriceBounds.max;
    const urlMin =
      initialMinPrice != null && initialMinPrice !== "" ? parseFloat(initialMinPrice) : boundsMin;
    const urlMax =
      initialMaxPrice != null && initialMaxPrice !== "" ? parseFloat(initialMaxPrice) : boundsMax;
    const validMin = isNaN(urlMin) ? boundsMin : urlMin;
    const validMax = isNaN(urlMax) ? boundsMax : urlMax;
    const next: [number, number] = [Math.min(validMin, validMax), Math.max(validMin, validMax)];

    if (
      Math.abs(uiRange[0] - next[0]) > 0.01 ||
      Math.abs(uiRange[1] - next[1]) > 0.01
    ) {
      setUiRange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPriceBounds?.min, collectionPriceBounds?.max]);

  // Sync filter UI from URL on external navigation (back/forward, shared links).
  // Uses filterKey (excludes page) so load-more / ?page=N does not re-run chip sync.
  // While pendingFilterKeyRef is set, wait until filterKey matches the pushed URL
  // before syncing so stale searchParams cannot overwrite optimistic handler state.
  useEffect(() => {
    const pending = pendingFilterKeyRef.current;
    if (pending !== null) {
      if (filterKey !== pending) {
        return;
      }
      pendingFilterKeyRef.current = null;
      return;
    }

    const fromUrl = readFilterUiStateFromSearchParams(
      safeSearchParams,
      collectionPriceBounds
    );
    const [nextMin, nextMax] = fromUrl.uiRange;

    if (
      Math.abs(uiRange[0] - nextMin) > 0.01 ||
      Math.abs(uiRange[1] - nextMax) > 0.01
    ) {
      setUiRange(fromUrl.uiRange);
    }
    if (!sameSortedStringList(selectedColors, fromUrl.colors)) {
      setSelectedColors(fromUrl.colors);
    }
    if (!sameSortedStringList(selectedSizes, fromUrl.sizes)) {
      setSelectedSizes(fromUrl.sizes);
    }
    if (!sameSortedStringList(selectedSubSubCategories, fromUrl.subSubCategories)) {
      setSelectedSubSubCategories(fromUrl.subSubCategories);
    }
    if (sortBy !== fromUrl.sort) {
      setSortBy(fromUrl.sort);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, collectionPriceBounds?.min, collectionPriceBounds?.max]);


  return (
    <CollectionBrowseProvider
      browseKey={collectionKey}
      snapshotRef={stateSnapshotRef}
    >
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-6 pt-8 pb-6 md:pb-16 relative">
        {/* Header with Filters Button */}
        <div className="mb-4 md:mb-4">
          <div className="mb-4">
            <h1 className="text-2xl md:text-4xl font-bold leading-tight text-black text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Sako's {getTranslatedName(selectedCategory, selectedSubcategory)} Collection
            </h1>
          </div>

          <div className={cn("flex items-center gap-3", lng === 'he' ? 'flex-row-reverse' : 'flex-row')}>
            {/* Desktop Filters Button */}
            <button
              onClick={() => setDesktopFiltersOpen(!desktopFiltersOpen)}
              className="hidden md:inline-flex items-center px-4 py-2 text-sm font-medium text-black bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors duration-200"
            >
              <FunnelIcon className={cn("h-4 w-4", lng === 'he' ? 'ml-2' : 'mr-2')} />
              {t.filters}
              {(() => {
                const [currentMin, currentMax] = uiRange;
                const boundsMin = collectionPriceBounds?.min ?? 0;
                const boundsMax = collectionPriceBounds?.max ?? 1000;
                const hasPriceFilter = currentMin > boundsMin || currentMax < boundsMax;
                const activeFilterCount = selectedColors.length + selectedSizes.length + selectedSubSubCategories.length + (hasPriceFilter ? 1 : 0);
                if (activeFilterCount > 0) {
                  return (
                    <span className={cn("bg-black text-white text-xs rounded-full px-2 py-1", lng === 'he' ? 'mr-2' : 'ml-2')}>
                      {activeFilterCount}
                    </span>
                  );
                }
                return null;
              })()}
            </button>

            {/* Mobile Filters Button */}
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="md:hidden inline-flex items-center px-4 py-2 text-sm font-medium text-black bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors duration-200"
            >
              <FunnelIcon className={cn("h-4 w-4", lng === 'he' ? 'ml-1' : 'mr-1')} />
              {t.filters}
              {(() => {
                const [currentMin, currentMax] = uiRange;
                const boundsMin = collectionPriceBounds?.min ?? 0;
                const boundsMax = collectionPriceBounds?.max ?? 1000;
                const hasPriceFilter = currentMin > boundsMin || currentMax < boundsMax;
                const activeFilterCount = selectedColors.length + selectedSizes.length + selectedSubSubCategories.length + (hasPriceFilter ? 1 : 0);
                if (activeFilterCount > 0) {
                  return (
                    <span className={cn("bg-black text-white text-xs rounded-full px-2 py-1", lng === 'he' ? 'mr-2' : 'ml-2')}>
                      {activeFilterCount}
                    </span>
                  );
                }
                return null;
              })()}
            </button>

            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger 
                className={cn(
                  "w-full sm:w-auto text-black md:py-3 md:px-4 md:text-base md:text-right",
                  lng === 'he' && "md:ml-auto"
                )} 
                dir={lng === 'he' ? 'rtl' : 'ltr'}
              >
                <SelectValue placeholder={t.relevance} />
              </SelectTrigger>
              <SelectContent dir={lng === 'he' ? 'rtl' : 'ltr'} className="md:text-base">
                <SelectItem value="relevance" dir={lng === 'he' ? 'rtl' : 'ltr'} className="md:py-2">{t.relevance}</SelectItem>
                <SelectItem value="price-low" dir={lng === 'he' ? 'rtl' : 'ltr'} className="md:py-2">{t.priceLow}</SelectItem>
                <SelectItem value="price-high" dir={lng === 'he' ? 'rtl' : 'ltr'} className="md:py-2">{t.priceHigh}</SelectItem>
                <SelectItem value="newest" dir={lng === 'he' ? 'rtl' : 'ltr'} className="md:py-2">{t.newest}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search Results Label */}
        {searchQuery && (
          <div className="w-full mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {lng === 'he' 
                    ? `תוצאות עבור: "${searchQuery}"`
                    : `Results for: "${searchQuery}"`
                  }
                </h2>
                {totalProducts !== undefined && (
                  <p className="text-sm text-gray-500 mt-1">
                    {lng === 'he'
                      ? `נמצאו ${totalProducts} תוצאות`
                      : `${totalProducts} result${totalProducts !== 1 ? 's' : ''} found`
                    }
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Showing X of Y counter */}
        {sortedItems.length > 0 && (
          <div className="mb-4 text-sm text-gray-600">
            {lng === 'he' 
              ? `${t.showing} ${useVariantItems ? allVariantItems.length : allProducts.length} ${t.of} ${totalProducts} ${t.items}`
              : `${t.showing} ${useVariantItems ? allVariantItems.length : allProducts.length} ${t.of} ${totalProducts} ${t.items}`
            }
          </div>
        )}

        {/* Products Grid - Full Width */}
        <div className="w-full">
          {sortedItems.length === 0 ? (
            <div className="text-center py-4">
              <CubeIcon className="mx-auto h-14 w-14 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {searchQuery 
                  ? (lng === 'he' ? `לא נמצאו תוצאות עבור "${searchQuery}"` : `No results found for "${searchQuery}"`)
                  : t.noProductsFound
                }
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery
                  ? (lng === 'he' ? 'נסה לשנות את מילות החיפוש או לבדוק את האיות.' : 'Try different search terms or check your spelling.')
                  : t.tryAdjusting
                }
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-2 sm:gap-6 -mx-3">
                {useVariantItems
                  ? (sortedItems as VariantItem[]).map((item, index) => {
                      // Calculate if item is above the fold (first 6-8 items)
                      // Mobile: 2 rows = 4 items, Desktop: 1-2 rows = 3-6 items
                      const isAboveFold = index < 6;
                      
                      return (
                        <div
                          key={item.variantKey}
                          data-collection-anchor={item.variantKey}
                          className="min-h-0"
                        >
                          <ProductCard 
                            product={item.product} 
                            language={lng as 'en' | 'he'}
                            selectedColors={selectedColors.length > 0 ? selectedColors : undefined}
                            preselectedColorSlug={item.variant.colorSlug}
                            isAboveFold={isAboveFold}
                            browseStoreKey={collectionKey}
                            collectionAnchorKey={item.variantKey}
                          />
                        </div>
                      );
                    })
                  : (sortedItems as Product[]).map((product, index) => {
                      // Calculate if product is above the fold (first 6-8 products)
                      // Mobile: 2 rows = 4 products, Desktop: 1-2 rows = 3-6 products
                      const isAboveFold = index < 6;
                      
                      return (
                        <div
                          key={product.id}
                          data-collection-anchor={String(product.id ?? product.sku)}
                          className="min-h-0"
                        >
                          <ProductCard 
                            product={product} 
                            language={lng as 'en' | 'he'}
                            selectedColors={selectedColors.length > 0 ? selectedColors : undefined}
                            isAboveFold={isAboveFold}
                            browseStoreKey={collectionKey}
                            collectionAnchorKey={String(product.id ?? product.sku)}
                          />
                        </div>
                      );
                    })}
              </div>
              
              {(hasMore || isLoadingMore) && (
                <div
                  className="relative mt-8 h-12 shrink-0"
                  style={{ overflowAnchor: "none" }}
                  aria-busy={isLoadingMore}
                  aria-live="polite"
                >
                  <div
                    ref={loadMoreSentinelRef}
                    className="pointer-events-none absolute bottom-0 left-0 h-px w-full"
                    aria-hidden
                  />
                  {isLoadingMore && (
                    <p className="flex h-12 items-center justify-center text-sm text-gray-500">
                      {t.loading}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Desktop Filter Overlay and Sidebar */}
      <AnimatePresence>
        {desktopFiltersOpen && (
          <>
            {/* Desktop Filter Overlay */}
            <div className="fixed inset-0 z-[68] lg:hidden">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/30"
                onClick={() => setDesktopFiltersOpen(false)}
              />
            </div>
            
            <div className="fixed inset-0 z-[68] hidden lg:block">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/30"
                onClick={() => setDesktopFiltersOpen(false)}
              />
            </div>
            
            {/* Desktop Filter Sidebar */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-80 bg-white shadow-2xl z-[70]"
            >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-lg font-light text-black tracking-wider uppercase">{t.filters}</h2>
            <button
              onClick={() => setDesktopFiltersOpen(false)}
              className="text-black hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <Accordion 
              type="multiple" 
              value={desktopAccordionValue}
              onValueChange={setDesktopAccordionValue}
              className="space-y-6"
            >
              {/* Price Filter */}
              <AccordionItem value="price" className="border border-gray-200 rounded-lg">
                <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                  <h3 className="text-sm font-medium text-black">{t.price}</h3>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4 pt-3 border-t border-gray-100">
                    {/* Price Range Label */}
                    <div className="text-sm font-medium text-gray-900">
                      ₪{formatPrice(uiRange[0])} - ₪{formatPrice(uiRange[1])}
                    </div>
                    
                    {/* Price Range Slider */}
                    <div className="px-2">
                      <Slider
                        value={uiRange}
                        onValueChange={handleSliderChange}
                        onValueCommit={handleSliderCommit}
                        min={Math.max(0, Math.floor((collectionPriceBounds.min - 200) / 10) * 10)}
                        max={Math.ceil((collectionPriceBounds.max + 200) / 10) * 10}
                        step={10}
                        className="w-full"
                        dir={lng === 'he' ? 'rtl' : 'ltr'}
                      />
                    </div>

                    {/* Reset Button */}
                    {(uiRange[0] !== collectionPriceBounds.min || uiRange[1] !== collectionPriceBounds.max) && (
                      <button
                        onClick={handlePriceReset}
                        className="text-xs text-gray-600 hover:text-gray-800 underline"
                      >
                        {lng === 'he' ? 'איפוס' : 'Reset'}
                      </button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Colors */}
              <AccordionItem value="colors" className="border border-gray-200 rounded-lg">
                <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                  <h3 className="text-sm font-medium text-black">{t.colors}</h3>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-2 pt-3 border-t border-gray-100">
                    {allColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleColorToggle(color)}
                        className={`w-full flex items-center space-x-3 p-2 rounded-sm transition-all duration-200 ${
                          selectedColors.includes(color)
                            ? 'bg-gray-100 border border-gray-300'
                            : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-full border border-gray-200"
                          style={{ backgroundColor: colorSlugToHex[color] || getColorHex(color) }}
                        />
                        <span className="text-sm font-light text-black">{getColorName(color, lng as 'en' | 'he')}</span>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Sizes */}
              <AccordionItem value="sizes" className="border border-gray-200 rounded-lg">
                <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                  <h3 className="text-sm font-medium text-black">{t.sizes}</h3>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4 pt-3 border-t border-gray-100">
                    {numericSizes.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-600 mb-2">Shoes</h4>
                        <div className="grid grid-cols-4 gap-2">
                          {numericSizes.map((size) => (
                            <button
                              key={size}
                              onClick={() => handleSizeToggle(size)}
                              className={`p-2 rounded-sm transition-all duration-200 text-center ${
                                selectedSizes.includes(size)
                                  ? 'bg-gray-100 border border-gray-300'
                                  : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                              }`}
                            >
                              <span className="text-sm font-light text-black">{size}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {alphaSizes.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-600 mb-2">Clothing</h4>
                        <div className="grid grid-cols-3 gap-2">
                          {alphaSizes.map((size) => (
                            <button
                              key={size}
                              onClick={() => handleSizeToggle(size)}
                              className={`p-2 rounded-sm transition-all duration-200 text-center ${
                                selectedSizes.includes(size)
                                  ? 'bg-gray-100 border border-gray-300'
                                  : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                              }`}
                            >
                              <span className="text-sm font-light text-black">{size}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Sub-Sub Categories */}
              {showSubSubCategoryFilter && Object.keys(subSubCategoriesByParent).length > 0 && (
                <AccordionItem value="subSubCategories" className="border border-gray-200 rounded-lg">
                  <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                    <h3 className="text-sm font-medium text-black">
                      {lng === 'he' ? 'תת-קטגוריות' : 'Sub-Categories'}
                    </h3>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4 pt-3 border-t border-gray-100">
                      {Object.entries(subSubCategoriesByParent).map(([parentId, subSubCats]) => (
                        <div key={parentId} className="space-y-2">
                          <h4 className="text-xs font-medium text-gray-600 mb-2">
                            {getParentCategoryName(parentId)}
                          </h4>
                          <div className="space-y-2">
                            {subSubCats.map((category) => (
                              <button
                                key={category.id}
                                onClick={() => handleSubSubCategoryToggle(category.id!)}
                                className={`w-full flex items-center p-2 rounded-sm transition-all duration-200 ${
                                  selectedSubSubCategories.includes(category.id!)
                                    ? 'bg-gray-100 border border-gray-300'
                                    : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                                }`}
                              >
                                <span className="text-sm font-light text-black">
                                  {getSubSubCategoryName(category)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>

            {/* Clear Filters Button */}
            {(() => {
              const [currentMin, currentMax] = uiRange;
              const boundsMin = collectionPriceBounds?.min ?? 0;
              const boundsMax = collectionPriceBounds?.max ?? 1000;
              const hasPriceFilter = currentMin > boundsMin || currentMax < boundsMax;
              if (selectedColors.length > 0 || selectedSizes.length > 0 || selectedSubSubCategories.length > 0 || hasPriceFilter) {
                return (
                  <div className="mb-6">
                    <button
                      onClick={handleClearFilters}
                      className="w-full py-2 px-4 text-sm font-light text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-200 border border-gray-200 rounded-sm"
                    >
                      {t.clearAllFilters}
                    </button>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          <div className="p-6 border-t border-gray-100">
            <button
              onClick={() => setDesktopFiltersOpen(false)}
              className="w-full py-3 px-4 bg-[#856D55]/90 text-white text-sm font-light tracking-wider uppercase hover:bg-[#856D55] transition-colors duration-200"
            >
              {t.applyFilters}
            </button>
          </div>
        </div>
      </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Filter Overlay */}
      <AnimatePresence>
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-[70] md:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/30"
              onClick={() => setMobileFiltersOpen(false)}
            />
            
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 h-full w-80 bg-white shadow-xl z-[71]"
            >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-lg font-light text-black tracking-wider uppercase">{t.filters}</h2>
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="text-black hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {/* Same filter content as desktop */}
                <Accordion 
                  type="multiple" 
                  value={mobileAccordionValue}
                  onValueChange={setMobileAccordionValue}
                  className="space-y-6"
                >
                  <AccordionItem value="price" className="border border-gray-200 rounded-lg">
                    <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                      <h3 className="text-sm font-medium text-black">{t.price}</h3>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4 pt-3 border-t border-gray-100">
                        {/* Price Range Label */}
                        <div className="text-sm font-medium text-gray-900">
                          ₪{formatPrice(uiRange[0])} - ₪{formatPrice(uiRange[1])}
                        </div>
                        
                         {/* Price Range Slider */}
                         <div className="px-2">
                           <Slider
                             value={uiRange}
                             onValueChange={handleSliderChange}
                             onValueCommit={handleSliderCommit}
                             min={Math.max(0, Math.floor((collectionPriceBounds.min - 200) / 10) * 10)}
                             max={Math.ceil((collectionPriceBounds.max + 200) / 10) * 10}
                             step={10}
                             className="w-full"
                             dir={lng === 'he' ? 'rtl' : 'ltr'}
                           />
                         </div>

                        {/* Reset Button */}
                        {(uiRange[0] !== collectionPriceBounds.min || uiRange[1] !== collectionPriceBounds.max) && (
                          <button
                            onClick={handlePriceReset}
                            className="text-xs text-gray-600 hover:text-gray-800 underline"
                          >
                            {lng === 'he' ? 'איפוס' : 'Reset'}
                          </button>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="colors" className="border border-gray-200 rounded-lg">
                    <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                      <h3 className="text-sm font-medium text-black">{t.colors}</h3>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-2 pt-3 border-t border-gray-100">
                        {allColors.map((color) => (
                          <button
                            key={color}
                            onClick={() => handleColorToggle(color)}
                            className={`w-full flex items-center space-x-3 p-2 rounded-sm transition-all duration-200 ${
                              selectedColors.includes(color)
                                ? 'bg-gray-100 border border-gray-300'
                                : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                            }`}
                          >
                            <div
                              className="w-6 h-6 rounded-full border border-gray-200"
                              style={{ backgroundColor: colorSlugToHex[color] || getColorHex(color) }}
                            />
                            <span className="text-sm font-light text-black">{getColorName(color, lng as 'en' | 'he')}</span>
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="sizes" className="border border-gray-200 rounded-lg">
                    <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                      <h3 className="text-sm font-medium text-black">{t.sizes}</h3>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4 pt-3 border-t border-gray-100">
                        {numericSizes.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-600 mb-2">Shoes</h4>
                            <div className="grid grid-cols-4 gap-2">
                              {numericSizes.map((size) => (
                                <button
                                  key={size}
                                  onClick={() => handleSizeToggle(size)}
                                  className={`p-2 rounded-sm transition-all duration-200 text-center ${
                                    selectedSizes.includes(size)
                                      ? 'bg-gray-100 border border-gray-300'
                                      : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                                  }`}
                                >
                                  <span className="text-sm font-light text-black">{size}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {alphaSizes.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-600 mb-2">Clothing</h4>
                            <div className="grid grid-cols-3 gap-2">
                              {alphaSizes.map((size) => (
                                <button
                                  key={size}
                                  onClick={() => handleSizeToggle(size)}
                                  className={`p-2 rounded-sm transition-all duration-200 text-center ${
                                    selectedSizes.includes(size)
                                      ? 'bg-gray-100 border border-gray-300'
                                      : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                                  }`}
                                >
                                  <span className="text-sm font-light text-black">{size}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Sub-Sub Categories - Mobile */}
                  {showSubSubCategoryFilter && Object.keys(subSubCategoriesByParent).length > 0 && (
                    <AccordionItem value="subSubCategories" className="border border-gray-200 rounded-lg">
                      <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                        <h3 className="text-sm font-medium text-black">
                          {lng === 'he' ? 'תת-קטגוריות' : 'Sub-Categories'}
                        </h3>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-4 pt-3 border-t border-gray-100">
                          {Object.entries(subSubCategoriesByParent).map(([parentId, subSubCats]) => (
                            <div key={parentId} className="space-y-2">
                              <h4 className="text-xs font-medium text-gray-600 mb-2">
                                {getParentCategoryName(parentId)}
                              </h4>
                              <div className="space-y-2">
                                {subSubCats.map((category) => (
                                  <button
                                    key={category.id}
                                    onClick={() => handleSubSubCategoryToggle(category.id!)}
                                    className={`w-full flex items-center p-2 rounded-sm transition-all duration-200 ${
                                      selectedSubSubCategories.includes(category.id!)
                                        ? 'bg-gray-100 border border-gray-300'
                                        : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                                    }`}
                                  >
                                    <span className="text-sm font-light text-black">
                                      {getSubSubCategoryName(category)}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>

                {/* Clear Filters Button */}
                {(() => {
                  const [currentMin, currentMax] = uiRange;
                  const boundsMin = collectionPriceBounds?.min ?? 0;
                  const boundsMax = collectionPriceBounds?.max ?? 1000;
                  const hasPriceFilter = currentMin > boundsMin || currentMax < boundsMax;
                  if (selectedColors.length > 0 || selectedSizes.length > 0 || selectedSubSubCategories.length > 0 || hasPriceFilter) {
                    return (
                      <div className="mb-6">
                        <button
                          onClick={handleClearFilters}
                          className="w-full py-2 px-4 text-sm font-light text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-200 border border-gray-200 rounded-sm"
                        >
                          {t.clearAllFilters}
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="p-6 border-t border-gray-100">
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="w-full py-3 px-4 bg-[#856D55]/90 text-white text-sm font-light tracking-wider uppercase hover:bg-[#856D55] transition-colors duration-200"
                >
                  {t.applyFilters}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
        )}
      </AnimatePresence>

      {/* Scroll to Top Button */}
      <ScrollToTopButton lng={lng as 'en' | 'he'} />
    </div>
    </CollectionBrowseProvider>
  );
}

