"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
  useTransition,
} from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion as fmMotion, AnimatePresence } from "framer-motion";
import { CubeIcon } from "@heroicons/react/24/outline";
import { Product, Category, productHelpers, VariantItem } from "@/lib/firebase";
import ProductCard from "@/app/components/ProductCard";
import CollectionProductCardSkeleton from "@/app/components/CollectionProductCardSkeleton";
import { trackViewItemList } from "@/lib/dataLayer";
import { getColorName, getColorHex } from "@/lib/colors";
import { cn } from "@/lib/utils";
import ScrollToTopButton from "@/app/components/ScrollToTopButton";
import ReadMoreContent from "@/app/components/ReadMoreContent";
import RichContent from "@/app/components/RichContent";
import InlineHeadingContent from "@/app/components/InlineHeadingContent";
import Loader from "@/app/components/ui/Loader";
import {
  markCollectionFilterNavPending,
  takeCollectionFilterNavPending,
} from "@/lib/collectionFilterNav";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import CollectionFilterPanel from '@/app/components/collection/CollectionFilterPanel';
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
  registerCollectionAnchorMounter,
  resetCollectionScrollForFilterChange,
  scrollCollectionToTop,
} from "@/lib/collectionScrollRestore";
import { useCollectionScrollRestore } from "@/lib/useCollectionScrollRestore";
import { fetchCollectionPagesUpTo } from "@/lib/collectionBrowseHydration";
import { useCollectionInfiniteScroll } from "@/lib/useCollectionInfiniteScroll";
import {
  useResponsiveColumnCount,
  type ColumnBreakpoint,
} from "@/lib/useResponsiveColumnCount";
import { useProductGridVirtualizer } from "@/lib/useProductGridVirtualizer";
import {
  captureScrollForAppend,
  restoreScrollAfterAppend,
  type ScrollAppendSnapshot,
} from "@/lib/preserveScrollOnAppend";
import {
  lockCollectionAppend,
  unlockCollectionAppend,
} from "@/lib/collectionAppendLock";
import { CollectionBrowseProvider } from "@/app/contexts/CollectionBrowseContext";
import {
  buildCollectionFilterKey,
  priceRangeToUrlParams,
  readFilterUiStateFromSearchParams,
} from "@/lib/collectionFilterUrl";
import { inStockSizeKeysFromVariant } from "@/lib/product-size";
import {
  dedupeProducts,
  dedupeVariantItems,
  useCollectionProductList,
} from "@/lib/useCollectionProductList";

const LISTING_PAGE_SIZE = 24;

/**
 * Horizontal inset for the collection blocks that are not full-bleed. 36px at
 * desktop is the frame's own gutter (438:2975 sets px-36.288); the filter bar and
 * the product grid deliberately do not use it, because 438:2962 runs both to the
 * viewport edge.
 */
const COLLECTION_INSET = "px-4 sm:px-6 lg:px-[36px]";

/**
 * Shared chrome for the two controls in the 438:2977 filter/sort bar.
 *
 * The caret trails the label, so in Hebrew it sits to the label's left exactly as
 * 438:2978 draws it. This is one place where the frame's coordinates are meant
 * literally rather than mirrored - see the bar itself, which keeps the frame's
 * sides too.
 *
 * 10px gap: the frame positions caret and label absolutely, 9.6px apart on the
 * sort control and ~12px on the filter one.
 */
const COLLECTION_BAR_CONTROL =
  "inline-flex items-center gap-[10px] font-ploni text-[12px] text-text-primary transition-opacity hover:opacity-70";

/**
 * The bar's caret (438:2979) is a small square rotated 45 degrees with two of its
 * edges drawn - a chevron built from a rectangle, which is exactly how the frame
 * vectors it. Borders are physical rather than logical on purpose: a caret points
 * down in both directions, and border-inline-end would swing it in RTL.
 */
function CollectionBarCaret() {
  // Deliberately an <i>, not a <span>. SelectTrigger styles every direct child
  // span with [&>span]:flex-1 / text-ellipsis to make the value fill the row; a
  // span caret got caught by that, stretched across the trigger - rendering as a
  // long diagonal stroke once rotated - and squeezed the label into an ellipsis.
  // Desktop only. 438:3523 draws the mobile bar as two bare labels - no caret
  // vectors at all - where 438:2978 gives the desktop controls one each.
  return (
    <i
      aria-hidden="true"
      className="mb-[3px] hidden size-[6.6px] shrink-0 rotate-45 border-b border-r border-text-primary lg:block"
    />
  );
}

// Mirrors the "collection-product-grid" grid-cols-2 lg:grid-cols-4 breakpoint
// (lib/collection-grid-critical-css.ts uses the same 1024px cutoff). 438:2984
// lays the desktop grid four across; this drives row-height estimation, so it has
// to move with the CSS or the virtualiser reserves the wrong height.
const COLLECTION_GRID_BREAKPOINTS: ColumnBreakpoint[] = [
  { minWidthPx: 0, columns: 2 },
  { minWidthPx: 1024, columns: 4 },
];
// Same 8.75rem (140px) reserved below the aspect-square image as the critical
// CSS in lib/collection-grid-critical-css.ts, so the initial size estimate
// lines up with what's already reserved before Tailwind/measureElement settle.
const COLLECTION_GRID_ROW_EXTRA_HEIGHT_PX = 140;
// Rows are absolutely positioned, so the space between them is each row's own
// bottom padding rather than the grid's row-gap. Zero: the cards butt together
// and their own borders do the dividing, so any value here reappears as a white
// hairline between rows.
const COLLECTION_GRID_ROW_GAP_PX = 0;

// NOTE: React 19 + Next 16 typecheck currently treats `motion.*` as not accepting
// animation props in this file. We cast it to avoid a build-blocking type error.
// (Runtime behavior remains unchanged.)
const motion = fmMotion as unknown as any;

/** Stable empty params — avoids `new URLSearchParams()` on every render when search is absent. */
const EMPTY_SEARCH_PARAMS = new URLSearchParams();

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
  initialAvailableFilterOptions?: {
    colors: string[];
    sizes: string[];
    subSubCategoryIds?: string[];
  };
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
  categorySeoContentTitle?: string;
  categorySeoContentHtml?: string;
  /** True when SSR already merged pages 1..N (?page=N deep link). */
  initialPagesBootstrapped?: boolean;
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
  categorySeoContentTitle,
  categorySeoContentHtml,
  initialPagesBootstrapped = false,
}: CollectionClientProps) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = translations[lng as keyof typeof translations] || translations.en;

  // Determine current collection level from slug (needed early for handleLoadMore)
  const slug = params?.slug as string[] | undefined;

  // Use variantItems if available (collection pages), otherwise fall back to products (search)
  const useVariantItems = initialVariantItems !== undefined && !searchQuery;
  
  // Serialized query string — stable across renders when URL params are unchanged.
  const searchParamsKey = searchParams?.toString() ?? "";

  const safeSearchParams = useMemo(() => {
    if (!searchParamsKey) return EMPTY_SEARCH_PARAMS;
    return new URLSearchParams(searchParamsKey);
  }, [searchParamsKey]);

  // Track filter/search key to detect when filters actually change (not just page)
  const filterKey = useMemo(() => {
    const params = searchParamsKey
      ? new URLSearchParams(searchParamsKey)
      : EMPTY_SEARCH_PARAMS;
    return buildCollectionFilterKey(params, {
      categoryPath,
      searchQuery,
    });
  }, [categoryPath, searchQuery, searchParamsKey]);

  // Stable key for this collection + filter/search combination
  const collectionKey = useMemo(() => {
    const base = `${lng}|${categoryPath || 'all'}|${searchQuery || ''}`;
    return `${base}|${filterKey}`;
  }, [lng, categoryPath, searchQuery, filterKey]);

  const [blockServerListSync, setBlockServerListSync] = useState(false);

  const {
    allVariantItems,
    setAllVariantItems,
    allProducts,
    setAllProducts,
    currentPage,
    setCurrentPage,
    totalProducts,
    setTotalProducts,
    hasMore,
    setHasMore,
    isLoadingMore,
    setIsLoadingMore,
    hydratedFromStoreRef,
    loadMoreEpochRef,
    loadMoreAbortRef,
  } = useCollectionProductList({
    filterKey,
    collectionKey,
    useVariantItems,
    initialVariantItems,
    initialProducts,
    searchTotal,
    searchPage,
    initialHasMore,
    skipServerSync: blockServerListSync,
  });

  const hydrationFallbackLoggedRef = useRef(false);
  const restoredFromUrlFetchRef = useRef<boolean>(initialPagesBootstrapped);
  const [browseListReady, setBrowseListReady] = useState(false);
  const [pinnedGridItemCount, setPinnedGridItemCount] = useState(0);
  const [isBrowseRefetching, setIsBrowseRefetching] = useState(false);
  const pathname = usePathname();
  const refetchOnReturnStartedRef = useRef(false);
  const browseRefetchInProgressRef = useRef(false);
  const returningRestoreActiveRef = useRef(false);
  /** Item count at load-more start; indices >= this skip entrance motion. */
  const loadMoreAppendBaselineRef = useRef(0);
  /** Scroll anchor captured right before append; restored in useLayoutEffect after DOM commit. */
  const appendRestoreRef = useRef<ScrollAppendSnapshot | null>(null);
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
      pendingListHydrationRef.current = 0;
      setBrowseListReady(true);
      return;
    }

    setBlockServerListSync(true);

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
      const currentLen = useVariantItems
        ? allVariantItems.length
        : allProducts.length;
      setPinnedGridItemCount(
        Math.max(stored?.items?.length ?? 0, currentLen)
      );
      setIsBrowseRefetching(true);
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
          setIsBrowseRefetching(false);
          setPinnedGridItemCount(0);
          pendingListHydrationRef.current = 0;
          setBrowseListReady(true);
          setBlockServerListSync(false);
        });
      return;
    }

    // Refetch already started (e.g. Strict Mode re-run) — do not mark list ready yet.
    if (
      browseRefetchInProgressRef.current ||
      (needsRefetch && refetchOnReturnStartedRef.current)
    ) {
      setBrowseListReady(false);
      if (stored?.items?.length) {
        finishBrowseListHydration(stored.items.length);
      }
      return;
    }

    if (stored?.items?.length) {
      finishBrowseListHydration(stored.items.length);
      setBlockServerListSync(false);
      return;
    }

    finishBrowseListHydration(0);
    setBlockServerListSync(false);
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

  // Pin viewport after load-more append (after DOM commit, before paint).
  useLayoutEffect(() => {
    const snapshot = appendRestoreRef.current;
    if (!snapshot) return;
    appendRestoreRef.current = null;
    restoreScrollAfterAppend(snapshot);
    unlockCollectionAppend();
  }, [allVariantItems.length, allProducts.length]);

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
          setBlockServerListSync(false);
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
          setBlockServerListSync(false);
        });
        return;
      }

      pendingListHydrationRef.current = 0;
      setBrowseListReady(true);
      setBlockServerListSync(false);
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
  // Skipped when SSR already merged pages (initialPagesBootstrapped).
  useEffect(() => {
    if (
      initialPagesBootstrapped ||
      !collectionKey ||
      hydratedFromStoreRef.current ||
      restoredFromUrlFetchRef.current
    ) {
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
    initialPagesBootstrapped,
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

    const epochAtStart = loadMoreEpochRef.current;
    cancelCollectionScrollRestoreWatchdog();
    lockCollectionAppend();
    loadMoreAppendBaselineRef.current = useVariantItems
      ? allVariantItems.length
      : allProducts.length;
    let loadingCleared = false;
    setIsLoadingMore(true);
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
          loadingCleared = true;
          return;
        }

        const snap = stateSnapshotRef.current;
        const prevVariantItems =
          snap?.useVariantItems && Array.isArray(snap.items)
            ? (snap.items as VariantItem[])
            : allVariantItems;
        const uniqueNewItems = dedupeVariantItems(
          prevVariantItems,
          newVariantItems
        );

        if (uniqueNewItems.length === 0) {
          console.warn(
            "All fetched variant items were duplicates, skipping append"
          );
          flushSync(() => {
            setCurrentPage(resolvedPage);
            setTotalProducts(data.total || totalProducts);
            setHasMore(data.hasMore || false);
            setIsLoadingMore(false);
            loadingCleared = true;
          });
          return;
        }

        appendRestoreRef.current = captureScrollForAppend();
        flushSync(() => {
          setAllVariantItems((prev) => {
            const unique = dedupeVariantItems(prev, newVariantItems);
            if (unique.length === 0) return prev;
            return [...prev, ...unique];
          });
          setCurrentPage(resolvedPage);
          setTotalProducts(data.total || totalProducts);
          setHasMore(data.hasMore || false);
          setIsLoadingMore(false);
          loadingCleared = true;
        });
      } else {
        const newItems = data.items || [];
        
        if (newItems.length === 0) {
          setHasMore(false);
          setIsLoadingMore(false);
          loadingCleared = true;
          return;
        }

        const snap = stateSnapshotRef.current;
        const prevProducts =
          snap && !snap.useVariantItems && Array.isArray(snap.items)
            ? (snap.items as Product[])
            : allProducts;
        const uniqueNewItems = dedupeProducts(prevProducts, newItems);

        if (uniqueNewItems.length === 0) {
          console.warn("All fetched items were duplicates, skipping append");
          flushSync(() => {
            setCurrentPage(resolvedPage);
            setTotalProducts(data.total || totalProducts);
            setHasMore(data.hasMore || false);
            setIsLoadingMore(false);
            loadingCleared = true;
          });
          return;
        }

        appendRestoreRef.current = captureScrollForAppend();
        flushSync(() => {
          setAllProducts((prev) => {
            const unique = dedupeProducts(prev, newItems);
            if (unique.length === 0) return prev;
            return [...prev, ...unique];
          });
          setCurrentPage(resolvedPage);
          setTotalProducts(data.total || totalProducts);
          setHasMore(data.hasMore || false);
          setIsLoadingMore(false);
          loadingCleared = true;
        });
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
      if (!loadingCleared) {
        setIsLoadingMore(false);
      }
      if (!appendRestoreRef.current) {
        unlockCollectionAppend();
      }
    }
  }, [
    isLoadingMore,
    hasMore,
    currentPage,
    categoryPath,
    searchQuery,
    lng,
    safeSearchParams,
    totalProducts,
    useVariantItems,
    allVariantItems,
    allProducts,
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

  // Collection price bounds (full range for slider) — needed when parsing URL price params.
  const collectionPriceBounds = useMemo(() => {
    const prices: number[] = [];

    if (useVariantItems && initialVariantItems) {
      if (initialVariantItems.length === 0) {
        return { min: 0, max: 1000 };
      }

      initialVariantItems.forEach((item) => {
        if (item.variant.isActive !== false) {
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
      if (initialProducts.length === 0) {
        return { min: 0, max: 1000 };
      }

      initialProducts.forEach((product) => {
        if (product.colorVariants && Object.keys(product.colorVariants).length > 0) {
          Object.values(product.colorVariants)
            .filter((v) => v.isActive !== false)
            .forEach((variant) => {
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
          const productPrice =
            product.salePrice && product.salePrice > 0
              ? product.salePrice
              : product.price;
          prices.push(productPrice);
        }
      });
    }

    if (prices.length === 0) {
      return { min: 0, max: 1000 };
    }

    const min = Math.floor(Math.min(...prices));
    const max = Math.ceil(Math.max(...prices));
    const minRounded = Math.floor(min / 10) * 10;
    const maxRounded = Math.ceil(max / 10) * 10;

    return { min: minRounded, max: maxRounded };
  }, [initialProducts, initialVariantItems, useVariantItems]);

  /** Filter chips, sort, and price range from URL (source of truth). */
  const urlFilterState = useMemo(
    () => readFilterUiStateFromSearchParams(safeSearchParams, collectionPriceBounds),
    [filterKey, collectionPriceBounds, searchParamsKey]
  );
  const selectedColors = urlFilterState.colors;
  const selectedSizes = urlFilterState.sizes;
  const selectedSubSubCategories = urlFilterState.subSubCategories;
  const sortBy = urlFilterState.sort;

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);
  const isFilterPanelOpen = mobileFiltersOpen || desktopFiltersOpen;
  const [isFilterNavigating, setIsFilterNavigating] = useState(() =>
    takeCollectionFilterNavPending()
  );
  const [isFilterTransitionPending, startFilterTransition] = useTransition();
  const isFilterLoading = isFilterNavigating || isFilterTransitionPending;

  type FilterDraft = {
    colors: string[];
    sizes: string[];
    subSubCategories: string[];
    uiRange: [number, number];
  };
  const [filterDraft, setFilterDraft] = useState<FilterDraft | null>(null);

  // Controlled state for accordion sections (desktop and mobile)
  // Using array to allow multiple sections open simultaneously
  // The redesigned filter panel (438:3094) has no accordions - its sections are
  // flat - so the two open-section states that tracked them are gone.

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

    const currentUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "";
    const isSameUrl = currentUrl === newUrl;

    if (isSameUrl) {
      return;
    }

    // Deferred one tick: this can fire from Radix Select's onValueChange, which is
    // still tearing down its portal/focus when a synchronous DOM swap here would
    // race with it (removeChild NotFoundError on iOS WebKit).
    //
    // IMPORTANT: setIsFilterNavigating must NOT be wrapped in flushSync. This flag
    // swaps the entire (potentially large, infinite-scroll-accumulated) product grid
    // out for skeleton placeholders. flushSync forces that whole subtree teardown to
    // happen synchronously, inline, on the current call stack — React's commit-phase
    // deletion-effects walk recurses one JS stack frame per unmounted DOM node, and on
    // a big grid this can exceed WebKit's (Safari/iOS) much shallower call stack,
    // throwing "RangeError: Maximum call stack size exceeded". Using a plain state
    // update lets React schedule the commit normally (on a fresh stack) instead.
    setTimeout(() => {
      markCollectionFilterNavPending();
      setIsFilterNavigating(true);
      resetCollectionScrollForFilterChange();
      scrollCollectionToTop();

      startFilterTransition(() => {
        router.push(newUrl, { scroll: false });
      });
      requestAnimationFrame(() => scrollCollectionToTop());
    }, 0);
  };

  const handleSortChange = (newSort: string) => {
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

  // Apply sorting to variant items or products (items are already filtered server-side)
  const sortedItems = useMemo(() => {
    if (useVariantItems) {
      // Keep server append order for relevance — re-sorting on load-more moves cards in the grid.
      if (sortBy === "relevance") {
        return allVariantItems;
      }
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
      if (sortBy === "relevance") {
        return allProducts;
      }
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

  const getGridItemKey = useCallback(
    (item: VariantItem | Product): string =>
      useVariantItems
        ? (item as VariantItem).variantKey
        : String((item as Product).id ?? (item as Product).sku),
    [useVariantItems]
  );

  const gridColumns = useResponsiveColumnCount(COLLECTION_GRID_BREAKPOINTS);

  const {
    containerRef: gridContainerRef,
    rows: gridRows,
    virtualItems: gridVirtualItems,
    totalSize: gridTotalSize,
    measureElement: measureGridRow,
    scrollToFlatIndex: scrollGridToFlatIndex,
  } = useProductGridVirtualizer<VariantItem | Product>({
    items: sortedItems as Array<VariantItem | Product>,
    columns: gridColumns,
    getItemKey: getGridItemKey,
    extraRowHeightPx: COLLECTION_GRID_ROW_EXTRA_HEIGHT_PX,
    rowGapPx: COLLECTION_GRID_ROW_GAP_PX,
  });

  // Lets the scroll-restore lib (lib/collectionScrollRestore.ts) force-mount a
  // virtualized-out anchor card by index when back-navigation needs to scroll
  // to a product the current render window doesn't include.
  const gridItemIndexRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const map = new Map<string, number>();
    (sortedItems as Array<VariantItem | Product>).forEach((item, index) => {
      map.set(getGridItemKey(item), index);
    });
    gridItemIndexRef.current = map;
  }, [sortedItems, getGridItemKey]);

  useEffect(() => {
    registerCollectionAnchorMounter((anchorKey) => {
      const index = gridItemIndexRef.current.get(anchorKey);
      if (index === undefined) return false;
      scrollGridToFlatIndex(index, "center");
      return true;
    });
    return () => registerCollectionAnchorMounter(null);
  }, [scrollGridToFlatIndex]);

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
            .filter((item) => item.variant.isActive !== false)
            .flatMap((item) => inStockSizeKeysFromVariant(item.variant))
        ),
      ] as string[];
    }
    return [
      ...new Set([
        ...initialProducts.flatMap((p) =>
          p.colorVariants
            ? Object.values(p.colorVariants)
                .filter((v) => v.isActive !== false)
                .flatMap((v) => inStockSizeKeysFromVariant(v))
            : []
        ),
      ]),
    ] as string[];
  }, [initialProducts, initialVariantItems, useVariantItems, initialAvailableFilterOptions]);

  const availableSubSubCategoryIds = useMemo(() => {
    const fromServer = initialAvailableFilterOptions?.subSubCategoryIds;
    if (fromServer?.length) return new Set(fromServer);
    return new Set<string>();
  }, [initialAvailableFilterOptions?.subSubCategoryIds]);

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

    if (availableSubSubCategoryIds.size > 0) {
      for (const parentId of Object.keys(grouped)) {
        grouped[parentId] = grouped[parentId].filter(
          (cat) => cat.id != null && availableSubSubCategoryIds.has(cat.id)
        );
        if (grouped[parentId].length === 0) {
          delete grouped[parentId];
        }
      }
    }
    
    return grouped;
  }, [
    categories,
    collectionLevel,
    selectedSubcategory,
    selectedCategory,
    categoryPath,
    lng,
    availableSubSubCategoryIds,
  ]);

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

  const urlUiRangeMin = urlFilterState.uiRange[0];
  const urlUiRangeMax = urlFilterState.uiRange[1];

  // Sync applied price slider when URL filters change (not while filter panel is open).
  useEffect(() => {
    if (isFilterPanelOpen) return;
    setUiRange([urlUiRangeMin, urlUiRangeMax]);
  }, [filterKey, isFilterPanelOpen, urlUiRangeMin, urlUiRangeMax]);

  // Seed draft when filter panel opens so toggles do not navigate until Apply.
  useEffect(() => {
    if (!isFilterPanelOpen) {
      setFilterDraft(null);
      return;
    }
    setFilterDraft({
      colors: [...selectedColors],
      sizes: [...selectedSizes],
      subSubCategories: [...selectedSubSubCategories],
      uiRange: [urlUiRangeMin, urlUiRangeMax],
    });
  }, [isFilterPanelOpen, filterKey, urlUiRangeMin, urlUiRangeMax]);

  const panelColors = filterDraft?.colors ?? selectedColors;
  const panelSizes = filterDraft?.sizes ?? selectedSizes;
  const panelSubSubCategories =
    filterDraft?.subSubCategories ?? selectedSubSubCategories;
  const panelUiRange = filterDraft?.uiRange ?? uiRange;

  const handleCloseFiltersPanel = () => {
    setUiRange(urlFilterState.uiRange);
    setFilterDraft(null);
    setMobileFiltersOpen(false);
    setDesktopFiltersOpen(false);
  };

  const handleApplyFilters = () => {
    if (!filterDraft || !collectionPriceBounds) {
      handleCloseFiltersPanel();
      return;
    }
    const { minPrice, maxPrice } = priceRangeToUrlParams(
      filterDraft.uiRange,
      collectionPriceBounds
    );
    updateURL({
      minPrice,
      maxPrice,
      colors: filterDraft.colors,
      sizes: filterDraft.sizes,
      sort: sortBy,
      subSubCategories: filterDraft.subSubCategories,
    });
    setUiRange(filterDraft.uiRange);
    setFilterDraft(null);
    setMobileFiltersOpen(false);
    setDesktopFiltersOpen(false);
  };

  const handleColorToggle = (color: string) => {
    if (isFilterPanelOpen && filterDraft) {
      setFilterDraft((d) => {
        if (!d) return d;
        const colors = d.colors.includes(color)
          ? d.colors.filter((c) => c !== color)
          : [...d.colors, color];
        return { ...d, colors };
      });
      return;
    }
    const newColors = selectedColors.includes(color)
      ? selectedColors.filter((c) => c !== color)
      : [...selectedColors, color];
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
      subSubCategories: selectedSubSubCategories,
    });
  };

  const handleSizeToggle = (size: string) => {
    if (isFilterPanelOpen && filterDraft) {
      setFilterDraft((d) => {
        if (!d) return d;
        const sizes = d.sizes.includes(size)
          ? d.sizes.filter((s) => s !== size)
          : [...d.sizes, size];
        return { ...d, sizes };
      });
      return;
    }
    const newSizes = selectedSizes.includes(size)
      ? selectedSizes.filter((s) => s !== size)
      : [...selectedSizes, size];
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
      subSubCategories: selectedSubSubCategories,
    });
  };

  const handleSubSubCategoryToggle = (categoryId: string) => {
    if (isFilterPanelOpen && filterDraft) {
      setFilterDraft((d) => {
        if (!d) return d;
        const subSubCategories = d.subSubCategories.includes(categoryId)
          ? d.subSubCategories.filter((id) => id !== categoryId)
          : [...d.subSubCategories, categoryId];
        return { ...d, subSubCategories };
      });
      return;
    }
    const newSubSubCategories = selectedSubSubCategories.includes(categoryId)
      ? selectedSubSubCategories.filter((id) => id !== categoryId)
      : [...selectedSubSubCategories, categoryId];
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
      subSubCategories: newSubSubCategories,
    });
  };

  const handleSliderChange = (values: number[]) => {
    const [min, max] = values;
    const validatedMin = Math.min(min, max);
    const validatedMax = Math.max(min, max);
    const next: [number, number] = [validatedMin, validatedMax];
    if (isFilterPanelOpen && filterDraft) {
      setFilterDraft((d) => (d ? { ...d, uiRange: next } : d));
      return;
    }
    setUiRange(next);
  };

  const handleSliderCommit = (values: number[]) => {
    const [min, max] = values as [number, number];
    const finalRange: [number, number] = [Math.min(min, max), Math.max(min, max)];
    if (isFilterPanelOpen && filterDraft) {
      setFilterDraft((d) => (d ? { ...d, uiRange: finalRange } : d));
      return;
    }
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

  const handlePriceReset = () => {
    const boundsMin = collectionPriceBounds?.min ?? 0;
    const boundsMax = collectionPriceBounds?.max ?? 1000;
    const full: [number, number] = [boundsMin, boundsMax];
    if (isFilterPanelOpen && filterDraft) {
      setFilterDraft((d) => (d ? { ...d, uiRange: full } : d));
      return;
    }
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

  const handleClearFilters = () => {
    const boundsMin = collectionPriceBounds?.min ?? 0;
    const boundsMax = collectionPriceBounds?.max ?? 1000;
    const full: [number, number] = [boundsMin, boundsMax];
    if (isFilterPanelOpen) {
      setFilterDraft({
        colors: [],
        sizes: [],
        subSubCategories: [],
        uiRange: full,
      });
      return;
    }
    setUiRange(full);
    updateURL({
      minPrice: "",
      maxPrice: "",
      colors: [],
      sizes: [],
      sort: "relevance",
      subSubCategories: [],
    });
  };

  const countActivePanelFilters = () => {
    const boundsMin = collectionPriceBounds?.min ?? 0;
    const boundsMax = collectionPriceBounds?.max ?? 1000;
    const [currentMin, currentMax] = panelUiRange;
    const hasPriceFilter =
      currentMin > boundsMin || currentMax < boundsMax;
    return (
      panelColors.length +
      panelSizes.length +
      panelSubSubCategories.length +
      (hasPriceFilter ? 1 : 0)
    );
  };

  // New instance after navigation: data is ready — hide bridged loader before paint.
  useLayoutEffect(() => {
    setIsFilterNavigating(false);
  }, []);

  useEffect(() => {
    if (!isFilterLoading) return;
    const id = window.setTimeout(() => setIsFilterNavigating(false), 30000);
    return () => window.clearTimeout(id);
  }, [isFilterLoading]);

  const openFilterPanel = (target: "mobile" | "desktop") => {
    setFilterDraft({
      colors: [...urlFilterState.colors],
      sizes: [...urlFilterState.sizes],
      subSubCategories: [...urlFilterState.subSubCategories],
      uiRange: urlFilterState.uiRange,
    });
    setUiRange(urlFilterState.uiRange);
    if (target === "mobile") setMobileFiltersOpen(true);
    else setDesktopFiltersOpen(true);
  };

  return (
    <CollectionBrowseProvider
      browseKey={collectionKey}
      snapshotRef={stateSnapshotRef}
    >
    <div className="min-h-screen bg-white">
      {isFilterLoading && (
        <Loader label={t.loadingProducts} />
      )}
      {/* Full-bleed shell. 438:2962 runs the filter bar and the product grid edge to
          edge - the grid's cards are 431.25px precisely because four of them plus
          three 1px gutters fill 1728. The max-w-7xl container that used to wrap the
          whole page is gone, and the blocks that are NOT meant to bleed carry
          COLLECTION_INSET themselves instead. */}
      <div
        className={cn(
          "relative w-full pt-8 pb-6 md:pb-16",
          isFilterLoading && "pointer-events-none"
        )}
        aria-busy={isFilterLoading}
      >
        {/* Header with Filters Button */}
        <div className="mb-4 md:mb-4">
          {/* The title is inset; the bar below it is not. */}
          <div className={cn("mb-4", COLLECTION_INSET)}>
            {/* 438:2962 carries no page title - it opens straight into the campaign
                hero. This one is kept for orientation and SEO, so it is set in the
                design system's own section-heading treatment instead of Poppins:
                Ploni Black at the same 32/48 step the carousel headers use. */}
            <h1 className="text-center font-ploni text-[32px] font-black leading-[32px] text-text-primary lg:text-[48px] lg:leading-[48px]">
              Sako's {getTranslatedName(selectedCategory, selectedSubcategory)} Collection
            </h1>
          </div>

          {/* Filter / sort bar, 438:2975 + 438:2977. A ruled band on paper, with the
              sort control on the right and filters on the left in Hebrew - the sides
              the frame draws them on, kept literally rather than mirrored.
              justify-between puts the FIRST child on the right under RTL, so the sort
              Select leads the markup here and the filter buttons follow. The chips,
              pills and grey rounded boxes are gone - this design system has no radius
              and no button fills outside the CTA. */}
          <div className="flex h-[58px] items-center justify-between border-y border-border-default bg-surface-secondary px-[16px] lg:h-[74px] lg:px-[36px]">
            <Select
              value={sortBy}
              onValueChange={handleSortChange}
              disabled={isFilterLoading}
            >
              {/* [&>svg]:hidden drops the Select's own lucide chevron so the frame's
                  rotated-square caret is the only one. */}
              <SelectTrigger
                className={cn(
                  COLLECTION_BAR_CONTROL,
                  "h-auto w-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:hidden",
                  isFilterLoading && "opacity-60 pointer-events-none"
                )}
                dir={lng === 'he' ? 'rtl' : 'ltr'}
              >
                <SelectValue placeholder={t.relevance} />
                <CollectionBarCaret />
              </SelectTrigger>
              <SelectContent dir={lng === 'he' ? 'rtl' : 'ltr'} className="font-ploni text-[12px]">
                <SelectItem value="relevance" dir={lng === 'he' ? 'rtl' : 'ltr'}>{t.relevance}</SelectItem>
                <SelectItem value="price-low" dir={lng === 'he' ? 'rtl' : 'ltr'}>{t.priceLow}</SelectItem>
                <SelectItem value="price-high" dir={lng === 'he' ? 'rtl' : 'ltr'}>{t.priceHigh}</SelectItem>
                <SelectItem value="newest" dir={lng === 'he' ? 'rtl' : 'ltr'}>{t.newest}</SelectItem>
              </SelectContent>
            </Select>

            {/* Desktop Filters Button */}
            <button
              type="button"
              onClick={() => {
                if (desktopFiltersOpen) handleCloseFiltersPanel();
                else openFilterPanel("desktop");
              }}
              className={cn(COLLECTION_BAR_CONTROL, "hidden md:inline-flex")}
            >
              {t.filters}
              {countActivePanelFilters() > 0 && (
                <span className="tabular-nums">({countActivePanelFilters()})</span>
              )}
              <CollectionBarCaret />
            </button>

            {/* Mobile Filters Button */}
            <button
              type="button"
              onClick={() => openFilterPanel("mobile")}
              className={cn(COLLECTION_BAR_CONTROL, "md:hidden")}
            >
              {t.filters}
              {countActivePanelFilters() > 0 && (
                <span className="tabular-nums">({countActivePanelFilters()})</span>
              )}
              <CollectionBarCaret />
            </button>
          </div>
        </div>

        {/* Search Results Label */}
        {searchQuery && (
          <div className={cn("mb-6 w-full", COLLECTION_INSET)}>
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

        {/* Showing X of Y counter — always reserve row height */}
        <div
          className={cn(
            "mb-4 min-h-[20px] font-ploni text-[12px] text-text-secondary",
            COLLECTION_INSET,
            sortedItems.length === 0 && "invisible"
          )}
          aria-hidden={sortedItems.length === 0}
        >
          {sortedItems.length > 0 &&
            (lng === 'he'
              ? `${t.showing} ${useVariantItems ? allVariantItems.length : allProducts.length} ${t.of} ${totalProducts} ${t.items}`
              : `${t.showing} ${useVariantItems ? allVariantItems.length : allProducts.length} ${t.of} ${totalProducts} ${t.items}`)}
        </div>

        {/* Products Grid - Full Width */}
        <div className="w-full">
          {isFilterLoading ? (
            <div
              className="collection-product-grid grid grid-cols-2 items-start gap-0 lg:grid-cols-4"
              aria-busy="true"
            >
              {Array.from({ length: LISTING_PAGE_SIZE }).map((_, index) => (
                <div key={`skeleton-${index}`}>
                  <CollectionProductCardSkeleton />
                </div>
              ))}
            </div>
          ) : sortedItems.length === 0 ? (
            <div className={cn("py-4 text-center", COLLECTION_INSET)}>
              <CubeIcon className="mx-auto h-14 w-14 text-text-secondary" />
              <h3 className="mt-2 font-ploni text-[16px] font-bold text-text-primary">
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
              {/* -mx-3 is gone with the max-w-7xl shell: it existed to pull the grid
                  back out of that container's padding, and against a full-bleed
                  parent it only dragged the cards 12px past the viewport edge. */}
              <div
                ref={gridContainerRef}
                style={{ position: "relative", height: gridTotalSize }}
              >
                {gridVirtualItems.map((virtualRow) => {
                  const row = gridRows[virtualRow.index];
                  if (!row) return null;

                  return (
                    <div
                      key={virtualRow.key}
                      ref={measureGridRow}
                      data-index={virtualRow.index}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.top}px)`,
                      }}
                      // Rows are absolutely positioned, so the space BETWEEN rows is
                      // this padding, not the grid's row-gap. It was sm:pb-6, which
                      // left a 24px white band under every row once the cards went
                      // flush. 1px from lg matches the column gutter.
                      className="pb-0"
                    >
                      <div className="collection-product-grid grid grid-cols-2 items-start gap-0 lg:grid-cols-4">
                        {row.items.map((item, i) => {
                          const flatIndex = row.startIndex + i;
                          const isAboveFold = flatIndex < 6;

                          if (useVariantItems) {
                            const variantItem = item as VariantItem;
                            return (
                              <div
                                key={variantItem.variantKey}
                                data-collection-anchor={variantItem.variantKey}
                              >
                                <ProductCard
                                  product={variantItem.product}
                                  language={lng as 'en' | 'he'}
                                  selectedColors={selectedColors.length > 0 ? selectedColors : undefined}
                                  preselectedColorSlug={variantItem.variant.colorSlug}
                                  disableImageCarousel
                                  isAboveFold={isAboveFold}
                                  browseStoreKey={collectionKey}
                                  collectionAnchorKey={variantItem.variantKey}
                                />
                              </div>
                            );
                          }

                          const product = item as Product;
                          const anchorKey = String(product.id ?? product.sku);
                          return (
                            <div key={anchorKey} data-collection-anchor={anchorKey}>
                              <ProductCard
                                product={product}
                                language={lng as 'en' | 'he'}
                                selectedColors={selectedColors.length > 0 ? selectedColors : undefined}
                                preselectedColorSlug={
                                  selectedColors.length === 0
                                    ? (product as { matchedColorSlug?: string }).matchedColorSlug
                                    : undefined
                                }
                                disableImageCarousel
                                isAboveFold={isAboveFold}
                                browseStoreKey={collectionKey}
                                collectionAnchorKey={anchorKey}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {isBrowseRefetching && pinnedGridItemCount > sortedItems.length && (
                <div className="collection-product-grid grid grid-cols-2 items-start gap-0 lg:grid-cols-4">
                  {Array.from({
                    length: pinnedGridItemCount - sortedItems.length,
                  }).map((_, index) => (
                    <div key={`refetch-skeleton-${index}`} aria-hidden>
                      <CollectionProductCardSkeleton />
                    </div>
                  ))}
                </div>
              )}

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

        {/* Category SEO Content */}
        {!searchQuery && categorySeoContentHtml?.trim() && (
          <section
            className={cn(
              'mt-12 border-t border-border-subtle pt-8 md:mt-16',
              COLLECTION_INSET,
              lng === 'he' ? 'text-right' : 'text-left'
            )}
            aria-label={lng === 'he' ? 'תוכן SEO' : 'Collection content'}
          >
            {categorySeoContentTitle && (
              <h2 className="mb-4 font-ploni text-[20px] font-bold text-text-primary md:text-[24px]">
                <InlineHeadingContent html={categorySeoContentTitle} />
              </h2>
            )}
            <ReadMoreContent lng={lng as 'en' | 'he'}>
              <RichContent
                html={categorySeoContentHtml}
                dir={lng === 'he' ? 'rtl' : 'ltr'}
              />
            </ReadMoreContent>
          </section>
        )}
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
                onClick={handleCloseFiltersPanel}
              />
            </div>
            
            <div className="fixed inset-0 z-[68] hidden lg:block">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/30"
                onClick={handleCloseFiltersPanel}
              />
            </div>
            
            {/* Desktop Filter Sidebar */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 z-[70] h-full w-full max-w-[501px] bg-surface-primary shadow-2xl"
            >
        <CollectionFilterPanel
          lng={lng}
          labels={{
            title: t.filters,
            price: t.price,
            colors: t.colors,
            sizes: t.sizes,
            subCategories: lng === 'he' ? 'תת-קטגוריות' : 'Sub-Categories',
            apply: t.applyFilters,
            clearAll: t.clearAllFilters,
            reset: lng === 'he' ? 'איפוס' : 'Reset',
            close: lng === 'he' ? 'סגירת הסינון' : 'Close filters',
          }}
          uiRange={panelUiRange}
          priceBounds={{ min: collectionPriceBounds?.min ?? 0, max: collectionPriceBounds?.max ?? 1000 }}
          onSliderChange={handleSliderChange}
          onSliderCommit={handleSliderCommit}
          onPriceReset={handlePriceReset}
          formatPrice={formatPrice}
          allColors={allColors}
          selectedColors={panelColors}
          onColorToggle={handleColorToggle}
          getColorHex={(color) => colorSlugToHex[color] || getColorHex(color)}
          getColorLabel={(color) => getColorName(color, lng as 'en' | 'he')}
          numericSizes={numericSizes}
          alphaSizes={alphaSizes}
          selectedSizes={panelSizes}
          onSizeToggle={handleSizeToggle}
          showSubSubCategoryFilter={showSubSubCategoryFilter}
          subSubCategoriesByParent={subSubCategoriesByParent}
          selectedSubSubCategories={panelSubSubCategories}
          onSubSubCategoryToggle={handleSubSubCategoryToggle}
          getParentCategoryName={getParentCategoryName}
          getSubSubCategoryName={getSubSubCategoryName}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          onClose={handleCloseFiltersPanel}
          isBusy={isFilterLoading}
        />
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
              onClick={handleCloseFiltersPanel}
            />
            
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 z-[71] h-full w-full max-w-[501px] bg-surface-primary shadow-xl"
            >
        <CollectionFilterPanel
          lng={lng}
          labels={{
            title: t.filters,
            price: t.price,
            colors: t.colors,
            sizes: t.sizes,
            subCategories: lng === 'he' ? 'תת-קטגוריות' : 'Sub-Categories',
            apply: t.applyFilters,
            clearAll: t.clearAllFilters,
            reset: lng === 'he' ? 'איפוס' : 'Reset',
            close: lng === 'he' ? 'סגירת הסינון' : 'Close filters',
          }}
          uiRange={panelUiRange}
          priceBounds={{ min: collectionPriceBounds?.min ?? 0, max: collectionPriceBounds?.max ?? 1000 }}
          onSliderChange={handleSliderChange}
          onSliderCommit={handleSliderCommit}
          onPriceReset={handlePriceReset}
          formatPrice={formatPrice}
          allColors={allColors}
          selectedColors={panelColors}
          onColorToggle={handleColorToggle}
          getColorHex={(color) => colorSlugToHex[color] || getColorHex(color)}
          getColorLabel={(color) => getColorName(color, lng as 'en' | 'he')}
          numericSizes={numericSizes}
          alphaSizes={alphaSizes}
          selectedSizes={panelSizes}
          onSizeToggle={handleSizeToggle}
          showSubSubCategoryFilter={showSubSubCategoryFilter}
          subSubCategoriesByParent={subSubCategoriesByParent}
          selectedSubSubCategories={panelSubSubCategories}
          onSubSubCategoryToggle={handleSubSubCategoryToggle}
          getParentCategoryName={getParentCategoryName}
          getSubSubCategoryName={getSubSubCategoryName}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          onClose={handleCloseFiltersPanel}
          isBusy={isFilterLoading}
        />
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

