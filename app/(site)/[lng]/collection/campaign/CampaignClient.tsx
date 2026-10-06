"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
  useTransition,
} from "react";
import { flushSync } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CubeIcon } from "@heroicons/react/24/outline";
import { Campaign, Category, VariantItem } from "@/lib/firebase";
import ProductCard from "@/app/components/ProductCard";
import ScrollToTopButton from "@/app/components/ScrollToTopButton";
import Loader from "@/app/components/ui/Loader";
import {
  markCollectionFilterNavPending,
  takeCollectionFilterNavPending,
} from "@/lib/collectionFilterNav";
import { getColorName, getColorHex } from "@/lib/colors";
import { cn } from "@/lib/utils";
import {
  getCollectionState,
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
import { CollectionBrowseProvider } from "@/app/contexts/CollectionBrowseContext";
import {
  priceRangeToUrlParams,
  readFilterUiStateFromSearchParams,
} from "@/lib/collectionFilterUrl";
import { inStockSizeKeysFromVariant } from "@/lib/product-size";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import CollectionFilterPanel, {
  type CollectionFilterPanelProps,
} from "@/app/components/collection/CollectionFilterPanel";
import SideDrawer from "@/app/components/ui/side-drawer";
import {
  COLLECTION_BAR,
  COLLECTION_BAR_CONTROL,
  COLLECTION_GRID_BREAKPOINTS,
  COLLECTION_GRID_ROW_GAP_PX,
  COLLECTION_GRID_TOP_RULE,
  COLLECTION_INSET,
  COLLECTION_LISTING_PAGE_SIZE,
  COLLECTION_PRODUCT_GRID,
  CollectionBarCaret,
  estimateCollectionRowHeight,
} from "@/app/components/collection/collectionChrome";
import { CollectionGridSkeleton } from "@/app/components/collection/CollectionListingSkeleton";
import { useResponsiveColumnCount } from "@/lib/useResponsiveColumnCount";
import { useProductGridVirtualizer } from "@/lib/useProductGridVirtualizer";
import {
  buildDisplayList,
  resolveBannerPlacements,
  type CollectionBanner,
} from "@/lib/collection-banners";
import CollectionGridBanner from "@/app/components/CollectionGridBanner";
import { useGridVirtualizationReady } from "@/lib/useGridVirtualizationReady";
import { useCollectionInfiniteScroll } from "@/lib/useCollectionInfiniteScroll";
import {
  captureScrollForAppend,
  restoreScrollAfterAppend,
  type ScrollAppendSnapshot,
} from "@/lib/preserveScrollOnAppend";
import {
  lockCollectionAppend,
  unlockCollectionAppend,
} from "@/lib/collectionAppendLock";

/**
 * A campaign's sub-subcategory section comes from its products, not from the URL.
 *
 * The collection listing derives this section from where the shopper is standing
 * in the category tree - it reads the route's root and subcategory slugs and
 * offers that branch's level-2 children. A campaign is a hand-picked set with no
 * position in the tree at all, so there is no branch to read: the only honest
 * source is which level-2 categories the campaign's own products actually sit in,
 * which the product query already reports as
 * `availableFilterOptions.subSubCategoryIds`. Those are bare ids, so the category
 * tree is passed in to resolve names and parents.
 *
 * Below this count the section is suppressed. A campaign that is all one kind of
 * shoe would otherwise draw a heading over a single choice that excludes nothing -
 * a case the collection listing never hits, because a category page's level-2
 * children always have siblings.
 */
const MIN_SUB_SUB_CATEGORY_OPTIONS = 2;

function formatPrice(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

const campaignTranslations = {
  en: {
    filters: "Filters",
    relevance: "Relevance",
    priceLow: "Price: Low to High",
    priceHigh: "Price: High to Low",
    newest: "Newest",
    price: "Price",
    colors: "Colors",
    sizes: "Sizes",
    clearAllFilters: "Clear All Filters",
    applyFilters: "Apply Filters",
    showing: "Showing",
    of: "of",
    items: "items",
    loadMore: "Load More",
    loading: "Loading...",
    loadingProducts: "Loading products...",
    noProducts: "No products found for this campaign",
    tryAdjusting: "Try adjusting your filters or search criteria.",
  },
  he: {
    filters: "סינון",
    relevance: "רלוונטיות",
    priceLow: "מחיר: נמוך לגבוה",
    priceHigh: "מחיר: גבוה לנמוך",
    newest: "החדשים ביותר",
    price: "מחיר",
    colors: "צבעים",
    sizes: "מידות",
    clearAllFilters: "נקה את כל המסננים",
    applyFilters: "החל מסננים",
    showing: "מציג",
    of: "מתוך",
    items: "מוצרים",
    loadMore: "טען עוד",
    loading: "טוען...",
    loadingProducts: "טוען מוצרים...",
    noProducts: "לא נמצאו מוצרים במבצע זה",
    tryAdjusting: "נסו להתאים את המסננים או קריטריוני החיפוש.",
  },
};

/** One slot in the rendered grid: a product, or a merchandising banner. */
type CampaignDisplayEntry =
  | { kind: "product"; item: VariantItem; productIndex: number }
  | { kind: "banner"; banner: CollectionBanner };

interface CampaignClientProps {
  campaign: Campaign;
  /** Enabled grid banners for this campaign; empty when none are configured. */
  gridBanners?: CollectionBanner[];
  initialVariantItems: VariantItem[];
  /** The whole enabled tree; only level-2 entries are read, to name the ids below. */
  categories: Category[];
  /** Stable filter options from full campaign so the filter list does not collapse after selection */
  initialAvailableFilterOptions?: {
    colors: string[];
    sizes: string[];
    subSubCategoryIds?: string[];
  };
  totalProducts?: number;
  hasMore?: boolean;
  lng: "en" | "he";
  initialSort?: string;
  initialMinPrice?: string;
  initialMaxPrice?: string;
}

export default function CampaignClient({
  campaign,
  gridBanners = [],
  initialVariantItems,
  categories,
  initialAvailableFilterOptions,
  totalProducts: initialTotal,
  hasMore: initialHasMore = false,
  lng,
  initialSort: initialSortProp = "relevance",
  initialMinPrice,
  initialMaxPrice,
}: CampaignClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = campaignTranslations[lng] || campaignTranslations.en;

  const [variantItems, setVariantItems] = useState<VariantItem[]>(initialVariantItems);
  const [totalProducts, setTotalProducts] = useState(initialTotal ?? initialVariantItems.length);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const filterKey = useMemo(() => {
    const safe = searchParams ?? new URLSearchParams();
    const parts: string[] = [];
    safe.forEach((value, key) => {
      if (key !== "page" && key !== "slug") parts.push(`${key}:${value}`);
    });
    return parts.sort().join("|");
  }, [searchParams]);

  // Store key includes filter so each filter combination has its own scroll/pagination state
  const campaignKey = useMemo(
    () => `campaign:${lng}:${campaign.id}|${filterKey}`,
    [lng, campaign.id, filterKey]
  );

  const hydratedFromStoreRef = useRef<boolean>(false);
  const [browseListReady, setBrowseListReady] = useState(false);
  const pathname = usePathname();

  const applyStoredBrowseState = useCallback(() => {
    if (!campaignKey) return false;
    const stored = getCollectionState(campaignKey);
    if (!stored) return false;
    hydratedFromStoreRef.current = true;
    const items = stored.items as VariantItem[];
    if (items?.length) setVariantItems(items);
    setCurrentPage(stored.currentPage);
    setTotalProducts(stored.totalProducts);
    setHasMore(stored.hasMore);
    return true;
  }, [campaignKey]);
  const prevCampaignIdRef = useRef<string | undefined>(campaign.id);
  const prevFilterKeyRef = useRef<string>(filterKey);
  const stateSnapshotRef = useRef<CollectionBrowseSnapshot | null>(null);
  /** Scroll anchor captured right before append; restored in useLayoutEffect after DOM commit. */
  const appendRestoreRef = useRef<ScrollAppendSnapshot | null>(null);

  const title = campaign.title[lng] || campaign.title.en || campaign.title.he;
  const description = campaign.description?.[lng] || campaign.description?.en || campaign.description?.he;

  const safeSearchParams = searchParams ?? new URLSearchParams();

  const urlFilterState = useMemo(
    () => readFilterUiStateFromSearchParams(safeSearchParams, undefined),
    [filterKey]
  );
  const selectedColors = urlFilterState.colors;
  const selectedSizes = urlFilterState.sizes;
  const selectedSubSubCategories = urlFilterState.subSubCategories;
  const sortBy = urlFilterState.sort;
  // One state, one panel - see the matching note in CollectionClient. The mobile
  // and desktop buttons used to hold a flag each and render a copy of the panel
  // each, which is how the two drifted apart.
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  type FilterDraft = {
    colors: string[];
    sizes: string[];
    subSubCategories: string[];
    uiRange: [number, number];
  };
  const [filterDraft, setFilterDraft] = useState<FilterDraft | null>(null);
  const [isFilterNavigating, setIsFilterNavigating] = useState(() =>
    takeCollectionFilterNavPending()
  );
  const [isFilterTransitionPending, startFilterTransition] = useTransition();
  const isFilterLoading = isFilterNavigating || isFilterTransitionPending;
  // The two accordion-state variables that used to live here are gone with the
  // hand-rolled filter drawers: the shared panel's sections are flat, so there is
  // no open/closed state to track.

  // Price bounds and UI range from initial variant items
  const collectionPriceBounds = useMemo(() => {
    const prices: number[] = [];
    initialVariantItems.forEach((item) => {
      if (item.variant.isActive !== false) {
        const p =
          item.variant.salePrice && item.variant.salePrice > 0
            ? item.variant.salePrice
            : item.product.salePrice && item.product.salePrice > 0
              ? item.product.salePrice
              : item.variant.priceOverride && item.variant.priceOverride > 0
                ? item.variant.priceOverride
                : item.product.price;
        prices.push(p);
      }
    });
    if (prices.length === 0) return { min: 0, max: 1000 };
    const min = Math.floor(Math.min(...prices));
    const max = Math.ceil(Math.max(...prices));
    return { min: Math.floor(min / 10) * 10, max: Math.ceil(max / 10) * 10 };
  }, [initialVariantItems]);

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

  const allColors = useMemo(() => {
    if (initialAvailableFilterOptions?.colors?.length) {
      return initialAvailableFilterOptions.colors;
    }
    return [
      ...new Set(
        initialVariantItems
          .filter((i) => i.variant.isActive !== false && i.variant.colorSlug)
          .map((i) => i.variant.colorSlug)
          .filter(Boolean)
      ),
    ] as string[];
  }, [initialVariantItems, initialAvailableFilterOptions]);
  const allSizes = useMemo(() => {
    if (initialAvailableFilterOptions?.sizes?.length) {
      return initialAvailableFilterOptions.sizes;
    }
    return [
      ...new Set(
        initialVariantItems
          .filter((i) => i.variant.isActive !== false)
          .flatMap((i) => inStockSizeKeysFromVariant(i.variant))
      ),
    ] as string[];
  }, [initialVariantItems, initialAvailableFilterOptions]);
  const numericSizes = allSizes.filter((s) => /^\d+(\.\d+)?$/.test(s)).sort((a, b) => parseFloat(a) - parseFloat(b));
  const alphaSizes = allSizes.filter((s) => !/^\d+(\.\d+)?$/.test(s)).sort();
  const colorSlugToHex = useMemo(() => {
    const map: Record<string, string> = {};
    initialVariantItems.forEach((item) => {
      if (item.variant.colorSlug) {
        map[item.variant.colorSlug] = (item.variant as any).colorHex || getColorHex(item.variant.colorSlug);
      }
    });
    allColors.forEach((c) => {
      if (!map[c]) map[c] = getColorHex(c);
    });
    return map;
  }, [initialVariantItems, allColors]);

  /**
   * The campaign's level-2 categories, grouped under their level-1 parent.
   *
   * Driven by the server's facet ids rather than by the items on screen: those
   * are one page of 24, so reading them would make the section grow as the
   * shopper scrolled. The facet pass covers the whole campaign and, since
   * buildFacetPassFilters now drops subSubCategoryIds, it keeps reporting every
   * option after one has been picked - which is what lets two be combined.
   *
   * Parent groups are ordered by the parent's own sortOrder so the section reads
   * in the same order as the navigation, and each group by its children's.
   */
  const subSubCategoriesByParent = useMemo(() => {
    const availableIds = new Set(initialAvailableFilterOptions?.subSubCategoryIds ?? []);
    if (availableIds.size === 0) return {};

    const parentSortOrder = new Map<string, number>();
    const grouped: Record<string, Category[]> = {};

    for (const category of categories) {
      if (category.level !== 2 || !category.isEnabled || !category.id) continue;
      if (!category.parentId || !availableIds.has(category.id)) continue;
      (grouped[category.parentId] ||= []).push(category);
    }

    for (const category of categories) {
      if (category.id && category.id in grouped) {
        parentSortOrder.set(category.id, category.sortOrder ?? 0);
      }
    }

    const ordered: Record<string, Category[]> = {};
    for (const parentId of Object.keys(grouped).sort(
      (a, b) => (parentSortOrder.get(a) ?? 0) - (parentSortOrder.get(b) ?? 0)
    )) {
      ordered[parentId] = grouped[parentId].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      );
    }
    return ordered;
  }, [categories, initialAvailableFilterOptions?.subSubCategoryIds]);

  const subSubCategoryOptionCount = useMemo(
    () =>
      Object.values(subSubCategoriesByParent).reduce(
        (total, group) => total + group.length,
        0
      ),
    [subSubCategoriesByParent]
  );
  const showSubSubCategoryFilter =
    subSubCategoryOptionCount >= MIN_SUB_SUB_CATEGORY_OPTIONS;

  const getParentCategoryName = useCallback(
    (parentId: string): string => {
      const parent = categories.find((cat) => cat.id === parentId);
      if (!parent) return "";
      return lng === "he" ? parent.name.he : parent.name.en;
    },
    [categories, lng]
  );

  const getSubSubCategoryName = useCallback(
    (category: Category): string =>
      lng === "he" ? category.name.he : category.name.en,
    [lng]
  );

  const basePath = `/${lng}/collection/campaign`;
  const updateURL = useCallback(
    (
      newFilters: {
        colors?: string[];
        sizes?: string[];
        subSubCategories?: string[];
        minPrice?: string;
        maxPrice?: string;
        sort?: string;
      },
      resetPage = true
    ) => {
      const params = new URLSearchParams();
      params.set("slug", campaign.slug);
      if (!resetPage && currentPage > 1) params.set("page", String(currentPage));
      if (newFilters.colors?.length) params.set("colors", newFilters.colors.join(","));
      if (newFilters.sizes?.length) params.set("sizes", newFilters.sizes.join(","));
      // Same param name the collection listing writes, and the one
      // parseFacetFiltersFromSearchParams already reads on both routes.
      if (newFilters.subSubCategories?.length) {
        params.set("subSubCategories", newFilters.subSubCategories.join(","));
      }
      if (newFilters.minPrice?.trim()) params.set("minPrice", newFilters.minPrice);
      if (newFilters.maxPrice?.trim()) params.set("maxPrice", newFilters.maxPrice);
      if (newFilters.sort && newFilters.sort !== "relevance") params.set("sort", newFilters.sort);
      const qs = params.toString();
      const newUrl = `${basePath}?${qs}`;
      const currentUrl =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "";
      if (currentUrl === newUrl) {
        return;
      }

      // Deferred one tick: this can fire from Radix Select's onValueChange, which
      // is still tearing down its portal/focus when a synchronous DOM swap here
      // would race with it (removeChild NotFoundError on iOS WebKit). The
      // collection listing has carried this deferral for a while; the campaign
      // bar is the same Radix Select and was missing it.
      //
      // IMPORTANT: setIsFilterNavigating must NOT be wrapped in flushSync. This
      // flag swaps the entire (potentially large, infinite-scroll-accumulated)
      // product grid out for skeleton placeholders. flushSync would force that
      // whole subtree teardown to happen synchronously, inline, on the current
      // call stack — React's commit-phase deletion-effects walk recurses one JS
      // stack frame per unmounted DOM node, and on a big grid this can exceed
      // WebKit's (Safari/iOS) much shallower call stack, throwing "RangeError:
      // Maximum call stack size exceeded". A plain state update lets React
      // schedule the commit normally (on a fresh stack) instead. See
      // CollectionClient.tsx for the same fix.
      setTimeout(() => {
        markCollectionFilterNavPending();
        setIsFilterNavigating(true);
        // Filtering changes what the list IS, so the old scroll offset means
        // nothing against the new one. The collection listing resets and returns
        // to the top here; without it the campaign page left the shopper deep in
        // a grid that had just been replaced under them.
        resetCollectionScrollForFilterChange();
        scrollCollectionToTop();

        startFilterTransition(() => {
          router.push(newUrl, { scroll: false });
        });
        requestAnimationFrame(() => scrollCollectionToTop());
      }, 0);
    },
    [basePath, campaign.slug, currentPage, router]
  );

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
      subSubCategories: selectedSubSubCategories,
      sort: newSort,
    });
  };
  useEffect(() => {
    if (!collectionPriceBounds || isFilterPanelOpen) return;
    const fromUrl = readFilterUiStateFromSearchParams(
      safeSearchParams,
      collectionPriceBounds
    );
    setUiRange(fromUrl.uiRange);
  }, [
    filterKey,
    collectionPriceBounds?.min,
    collectionPriceBounds?.max,
    safeSearchParams,
    isFilterPanelOpen,
  ]);

  useEffect(() => {
    if (!isFilterPanelOpen) setFilterDraft(null);
  }, [isFilterPanelOpen]);

  const panelColors = filterDraft?.colors ?? selectedColors;
  const panelSizes = filterDraft?.sizes ?? selectedSizes;
  const panelSubSubCategories =
    filterDraft?.subSubCategories ?? selectedSubSubCategories;
  const panelUiRange = filterDraft?.uiRange ?? uiRange;

  const handleCloseFiltersPanel = () => {
    const fromUrl = readFilterUiStateFromSearchParams(
      safeSearchParams,
      collectionPriceBounds
    );
    setUiRange(fromUrl.uiRange);
    setFilterDraft(null);
    setIsFilterPanelOpen(false);
  };

  const handleApplyFilters = () => {
    if (!filterDraft) {
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
      subSubCategories: filterDraft.subSubCategories,
      sort: sortBy,
    });
    setUiRange(filterDraft.uiRange);
    setFilterDraft(null);
    setIsFilterPanelOpen(false);
  };

  const openFilterPanel = () => {
    const fromUrl = readFilterUiStateFromSearchParams(
      safeSearchParams,
      collectionPriceBounds
    );
    setFilterDraft({
      colors: [...fromUrl.colors],
      sizes: [...fromUrl.sizes],
      subSubCategories: [...fromUrl.subSubCategories],
      uiRange: fromUrl.uiRange,
    });
    setUiRange(fromUrl.uiRange);
    setIsFilterPanelOpen(true);
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
    const next = panelColors.includes(color)
      ? selectedColors.filter((c) => c !== color)
      : [...selectedColors, color];
    const { minPrice, maxPrice } = priceRangeToUrlParams(
      uiRange,
      collectionPriceBounds
    );
    updateURL({
      colors: next,
      sizes: selectedSizes,
      subSubCategories: selectedSubSubCategories,
      minPrice,
      maxPrice,
      sort: sortBy,
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
    const next = panelSizes.includes(size)
      ? selectedSizes.filter((s) => s !== size)
      : [...selectedSizes, size];
    const { minPrice, maxPrice } = priceRangeToUrlParams(
      uiRange,
      collectionPriceBounds
    );
    updateURL({
      colors: selectedColors,
      sizes: next,
      subSubCategories: selectedSubSubCategories,
      minPrice,
      maxPrice,
      sort: sortBy,
    });
  };

  const handleSliderChange = (values: number[]) => {
    const [min, max] = values;
    const next: [number, number] = [Math.min(min, max), Math.max(min, max)];
    if (isFilterPanelOpen && filterDraft) {
      setFilterDraft((d) => (d ? { ...d, uiRange: next } : d));
      return;
    }
    setUiRange(next);
  };

  const handleSliderCommit = (values: number[]) => {
    const [min, max] = values as [number, number];
    const final: [number, number] = [Math.min(min, max), Math.max(min, max)];
    if (isFilterPanelOpen && filterDraft) {
      setFilterDraft((d) => (d ? { ...d, uiRange: final } : d));
      return;
    }
    setUiRange(final);
    const { minPrice, maxPrice } = priceRangeToUrlParams(
      final,
      collectionPriceBounds
    );
    updateURL({
      minPrice,
      maxPrice,
      colors: selectedColors,
      sizes: selectedSizes,
      subSubCategories: selectedSubSubCategories,
      sort: sortBy,
    });
  };

  const handlePriceReset = () => {
    const { min, max } = collectionPriceBounds;
    if (isFilterPanelOpen && filterDraft) {
      setFilterDraft((d) => (d ? { ...d, uiRange: [min, max] } : d));
      return;
    }
    setUiRange([min, max]);
    updateURL({
      minPrice: "",
      maxPrice: "",
      colors: selectedColors,
      sizes: selectedSizes,
      subSubCategories: selectedSubSubCategories,
      sort: sortBy,
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
    const next = selectedSubSubCategories.includes(categoryId)
      ? selectedSubSubCategories.filter((id) => id !== categoryId)
      : [...selectedSubSubCategories, categoryId];
    const { minPrice, maxPrice } = priceRangeToUrlParams(
      uiRange,
      collectionPriceBounds
    );
    updateURL({
      colors: selectedColors,
      sizes: selectedSizes,
      subSubCategories: next,
      minPrice,
      maxPrice,
      sort: sortBy,
    });
  };

  const handleClearFilters = () => {
    const { min, max } = collectionPriceBounds;
    if (isFilterPanelOpen) {
      setFilterDraft({
        colors: [],
        sizes: [],
        subSubCategories: [],
        uiRange: [min, max],
      });
      return;
    }
    setUiRange([min, max]);
    updateURL({
      minPrice: "",
      maxPrice: "",
      colors: [],
      sizes: [],
      subSubCategories: [],
      sort: "relevance",
    });
  };

  const isReturningFromProduct = useCallback(() => {
    const pending = readLastCollectionScroll();
    return (
      !!campaignKey &&
      pending?.browseKey === campaignKey &&
      pending.scrollY > 0
    );
  }, [campaignKey]);

  const sortedItems = useMemo(() => {
    const sorted = [...variantItems].sort((a, b) => {
      const getPrice = (item: VariantItem) =>
        item.variant.salePrice && item.variant.salePrice > 0
          ? item.variant.salePrice
          : item.product.salePrice && item.product.salePrice > 0
            ? item.product.salePrice
            : item.variant.priceOverride && item.variant.priceOverride > 0
              ? item.variant.priceOverride
              : item.product.price;
      switch (sortBy) {
        case "price-low":
          return getPrice(a) - getPrice(b);
        case "price-high":
          return getPrice(b) - getPrice(a);
        case "newest":
          const dateA = a.product.createdAt ? new Date(a.product.createdAt).getTime() : 0;
          const dateB = b.product.createdAt ? new Date(b.product.createdAt).getTime() : 0;
          return dateB - dateA;
        default:
          return 0;
      }
    });
    return sorted;
  }, [variantItems, sortBy]);

  const getGridItemKey = useCallback(
    (entry: CampaignDisplayEntry): string =>
      entry.kind === "banner" ? `banner-${entry.banner.id}` : entry.item.variantKey,
    []
  );
  const gridColumns = useResponsiveColumnCount(COLLECTION_GRID_BREAKPOINTS);

  /**
   * Banners are merchandising for the default listing only. A shopper who has
   * filtered has intent, and an interruption costs more there - so any applied
   * filter takes them out entirely rather than shifting them. Same rule as the
   * collection listing; a campaign has no search, so there is no search guard.
   */
  const bannersApply =
    gridBanners.length > 0 &&
    selectedColors.length === 0 &&
    selectedSizes.length === 0 &&
    selectedSubSubCategories.length === 0 &&
    // Read from the URL rather than from urlFilterState, which exposes price as
    // a [min, max] pair defaulted to the bounds - indistinguishable from "no
    // price filter". The params are the only place the distinction survives.
    !safeSearchParams.get("minPrice") &&
    !safeSearchParams.get("maxPrice");

  const bannerPlacements = useMemo(
    () =>
      bannersApply
        ? resolveBannerPlacements(gridBanners, gridColumns, sortedItems.length)
        : [],
    [bannersApply, gridBanners, gridColumns, sortedItems.length]
  );

  /**
   * What the grid renders. Products keep their own array, order and indices -
   * totalProducts, the load-more baseline and the "showing X of Y" counter all
   * read from that, so banners exist only in this derived view.
   */
  const displayItems = useMemo(
    () => buildDisplayList(sortedItems, bannerPlacements),
    [sortedItems, bannerPlacements]
  );

  // Products are in the server HTML only while this is false. See
  // useGridVirtualizationReady — it flips one tick after hydration.
  const gridVirtualizationReady = useGridVirtualizationReady();

  const {
    containerRef: gridContainerRef,
    rows: gridRows,
    virtualItems: gridVirtualItems,
    totalSize: gridTotalSize,
    measureElement: measureGridRow,
    isVirtualized: isGridVirtualized,
  } = useProductGridVirtualizer<CampaignDisplayEntry>({
    items: displayItems,
    columns: gridColumns,
    getItemKey: getGridItemKey,
    estimateRowHeight: estimateCollectionRowHeight,
    rowGapPx: COLLECTION_GRID_ROW_GAP_PX,
    enabled: gridVirtualizationReady,
  });

  /**
   * One grid slot. Shared by the virtualized rows and the plain pre-hydration
   * grid so the two cannot render a card differently — the static pass is what a
   * crawler sees, so it has to be the same markup, not an SEO-only stand-in.
   */
  const renderGridItem = useCallback(
    (entry: CampaignDisplayEntry, flatIndex: number) => {
      if (entry.kind === "banner") {
        return (
          <CollectionGridBanner
            key={`banner-${entry.banner.id}`}
            banner={entry.banner}
            lng={lng}
          />
        );
      }

      const item = entry.item;
      return (
        <div key={item.variantKey} data-collection-anchor={item.variantKey}>
          <ProductCard
            product={item.product}
            language={lng}
            selectedColors={selectedColors.length > 0 ? selectedColors : undefined}
            preselectedColorSlug={item.variant.colorSlug}
            disableImageCarousel
            isAboveFold={flatIndex < 6}
            browseStoreKey={campaignKey}
            collectionAnchorKey={item.variantKey}
          />
        </div>
      );
    },
    [lng, selectedColors, campaignKey]
  );

  /**
   * Placeholders for the page being fetched, sized to the next two rows rather
   * than the whole 24 — same rule as the collection listing.
   */
  const loadMoreSkeletonCount = isLoadingMore
    ? Math.max(
        0,
        Math.min(gridColumns * 2, Math.max(0, totalProducts - sortedItems.length))
      )
    : 0;

  /**
   * Drives the "(n)" beside the Filters label in the bar. Reads the draft while a
   * panel is open so the count tracks what the user is choosing, not what is
   * committed to the URL - same as the collection bar.
   */
  /** Same label set the collection listing hands the shared panel. */
  const filterPanelLabels: CollectionFilterPanelProps["labels"] = {
    title: t.filters,
    price: t.price,
    colors: t.colors,
    sizes: t.sizes,
    subCategories: lng === "he" ? "תת-קטגוריות" : "Sub-Categories",
    apply: t.applyFilters,
    clearAll: t.clearAllFilters,
    reset: lng === "he" ? "איפוס" : "Reset",
    close: lng === "he" ? "סגירת הסינון" : "Close filters",
  };

  const countActivePanelFilters = () => {
    const boundsMin = collectionPriceBounds?.min ?? 0;
    const boundsMax = collectionPriceBounds?.max ?? 1000;
    const [currentMin, currentMax] = panelUiRange;
    const hasPriceFilter = currentMin > boundsMin || currentMax < boundsMax;
    return (
      panelColors.length +
      panelSizes.length +
      panelSubSubCategories.length +
      (hasPriceFilter ? 1 : 0)
    );
  };

  // Hydrate from store before paint when returning from PDP
  useLayoutEffect(() => {
    setBrowseListReady(false);

    if (!campaignKey) {
      setBrowseListReady(true);
      return;
    }

    if (!isReturningFromProduct()) {
      setBrowseListReady(true);
      return;
    }

    applyStoredBrowseState();
    setBrowseListReady(true);
  }, [campaignKey, pathname, applyStoredBrowseState, isReturningFromProduct]);

  useEffect(() => {
    const onBrowseReturn = () => {
      const pending = readLastCollectionScroll();
      if (
        !campaignKey ||
        pending?.browseKey !== campaignKey ||
        pending.scrollY <= 0
      ) {
        return;
      }
      applyStoredBrowseState();
      setBrowseListReady(true);
    };

    window.addEventListener(COLLECTION_RETURN_EVENT, onBrowseReturn);
    return () =>
      window.removeEventListener(COLLECTION_RETURN_EVENT, onBrowseReturn);
  }, [campaignKey, applyStoredBrowseState]);

  // Sync from server when campaign or filters change; reset when filterKey changes
  useEffect(() => {
    if (prevCampaignIdRef.current !== campaign.id) {
      prevCampaignIdRef.current = campaign.id;
      hydratedFromStoreRef.current = false;
    }
    const filterChanged = prevFilterKeyRef.current !== filterKey;
    if (filterChanged) {
      prevFilterKeyRef.current = filterKey;
      hydratedFromStoreRef.current = false;
      setVariantItems(initialVariantItems);
      setTotalProducts(initialTotal ?? initialVariantItems.length);
      setHasMore(initialHasMore ?? false);
      setCurrentPage(1);
      return;
    }
    if (hydratedFromStoreRef.current) return;

    setVariantItems(initialVariantItems);
    setTotalProducts(initialTotal ?? initialVariantItems.length);
    setHasMore(initialHasMore ?? false);
    setCurrentPage(1);
  }, [campaign.id, filterKey, initialVariantItems, initialTotal, initialHasMore]);

  // Format end date for display
  const formatEndDate = (dateString?: string): string | null => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      return lng === "he" ? `${day}/${month}` : `${month}/${day}`;
    } catch {
      return null;
    }
  };

  const endDateFormatted = formatEndDate(campaign.endAt);

  // Keep snapshot ref updated so we can persist on unmount (same as CollectionClient)
  stateSnapshotRef.current = {
    useVariantItems: true,
    items: variantItems,
    currentPage,
    totalProducts,
    hasMore,
  };

  useCollectionScrollRestore({
    browseKey: campaignKey,
    itemCount: sortedItems.length,
    snapshotRef: stateSnapshotRef,
    browseListReady,
    persistDeps: [
      variantItems.length,
      currentPage,
      totalProducts,
      hasMore,
    ],
  });

  // The banner and the campaign copy live in CampaignHero now, rendered by
  // page.tsx above this component and outside the Suspense boundary that waits
  // on the product query — so the hero is in the first paint instead of arriving
  // after it and pushing this listing down the page.

  // Load more: pass all current filter params so API returns next page of filtered set
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    const nextPage = currentPage + 1;
    cancelCollectionScrollRestoreWatchdog();
    lockCollectionAppend();
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("language", lng);
      params.set("slug", campaign.slug);
      const current = searchParams ?? new URLSearchParams();
      current.forEach((value, key) => {
        if (key !== "page" && key !== "slug") params.set(key, value);
      });
      const res = await fetch(`/api/products/campaign?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load more");
      const data = await res.json();
      const nextItems = (data.variantItems ?? []) as VariantItem[];

      // Pin the viewport to a card that is on screen right now, then commit the
      // append synchronously so the useLayoutEffect below can put that same card
      // back at the same offset before the browser paints.
      //
      // This replaces a pair of rAFs that re-applied a stored absolute scrollY.
      // Storing an absolute offset means the restore fights the user if they kept
      // scrolling during the fetch, and it had to carry a `stillOnSamePage` guard
      // because the frames could land on the product page after a card tap.
      // Anchoring to a card needs neither - the collection listing has worked this
      // way for a while, and the two pages now page identically.
      if (nextItems.length > 0) {
        appendRestoreRef.current = captureScrollForAppend();
        flushSync(() => {
          setVariantItems((prev) => {
            const existingKeys = new Set(prev.map((i) => i.variantKey));
            const newItems = nextItems.filter((i) => !existingKeys.has(i.variantKey));
            return [...prev, ...newItems];
          });
          setCurrentPage(data.page ?? nextPage);
          setTotalProducts(data.total ?? totalProducts);
          setHasMore(Boolean(data.hasMore));
        });
      } else {
        setCurrentPage(data.page ?? nextPage);
        setTotalProducts(data.total ?? totalProducts);
        setHasMore(Boolean(data.hasMore));
      }

      const urlParams = new URLSearchParams((searchParams ?? new URLSearchParams()).toString());
      urlParams.set("page", String(nextPage));
      const newUrl = `${basePath}?${urlParams.toString()}`;
      if (typeof window !== "undefined") {
        window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, "", newUrl);
      }
    } catch (e) {
      console.error("Campaign load more error:", e);
    } finally {
      setIsLoadingMore(false);
      if (!appendRestoreRef.current) {
        unlockCollectionAppend();
      }
    }
  }, [isLoadingMore, hasMore, currentPage, lng, campaign.slug, totalProducts, searchParams, basePath]);

  // Pin viewport after load-more append (after DOM commit, before paint).
  useLayoutEffect(() => {
    const snapshot = appendRestoreRef.current;
    if (!snapshot) return;
    appendRestoreRef.current = null;
    restoreScrollAfterAppend(snapshot);
    unlockCollectionAppend();
  }, [variantItems.length]);

  // The campaign listing used a "Load More" button; the collection listing pulls
  // the next page in as the sentinel nears the viewport. Same hook, so the two
  // pages page the same way and the button's brand-coloured pill can go.
  const { sentinelRef: loadMoreSentinelRef } = useCollectionInfiniteScroll({
    hasMore,
    browseListReady,
    isLoadingMore,
    onLoadMore: handleLoadMore,
    resetKey: campaignKey,
  });

  useLayoutEffect(() => {
    setIsFilterNavigating(false);
  }, []);

  useEffect(() => {
    if (!isFilterLoading) return;
    const id = window.setTimeout(() => setIsFilterNavigating(false), 30000);
    return () => window.clearTimeout(id);
  }, [isFilterLoading]);

  return (
    <CollectionBrowseProvider
      browseKey={campaignKey}
      snapshotRef={stateSnapshotRef}
    >
    {/* No min-h-screen here any more: page.tsx wraps the hero and this listing
        in one, and a second one nested under the hero would reserve a viewport's
        worth below it that a short campaign never fills. */}
    <div className="bg-surface-secondary">
      {isFilterLoading && <Loader label={t.loadingProducts} />}
      {/* Full-bleed shell, 438:2962 - the same one the collection listing uses. The
          max-w-7xl container that used to wrap this page is gone: the grid and the
          filter bar run to the viewport edge, and the blocks that are NOT meant to
          bleed carry COLLECTION_INSET themselves. */}
      {/* pt-4, matching the mb-4 the title carries below itself: the two gaps either
          side of the heading are the same 16px, so it reads as centred in its own
          band between whatever is above it and the filter bar's top rule. It was
          pt-8, which left twice as much room above as below. */}
      <div
        className={cn(
          "relative w-full pt-4 pb-6 md:pb-16",
          isFilterLoading && "pointer-events-none"
        )}
        aria-busy={isFilterLoading}
      >
        {/* No bottom margin: the grid butts straight onto the filter bar, so the
            bar's underside and the top of the first card row are one rule rather
            than two with a band of ground between them. */}
        <div>
          {/* The campaign's own title, in the listing's section-heading treatment.
              The page carried no heading at all before - the name lived only inside
              the banner artwork, so there was nothing here for assistive tech or
              for search. */}
          <div className={cn("mb-4", COLLECTION_INSET)}>
            <h1 className="text-center font-ploni text-[32px] font-black leading-[32px] text-text-primary lg:text-[48px] lg:leading-[48px]">
              {title}
            </h1>
          </div>

          {/* Filter / sort bar, 438:2975 + 438:2977. justify-between puts the FIRST
              child on the right under RTL, so the sort Select leads the markup here
              and the filter buttons follow - the sides the frame draws them on,
              kept literally rather than mirrored. The grey rounded pills, the funnel
              icon and the black count bubble are gone: this design system has no
              radius and no button fills outside the CTA. */}
          <div className={COLLECTION_BAR}>
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
                dir={lng === "he" ? "rtl" : "ltr"}
              >
                <SelectValue placeholder={t.relevance} />
                <CollectionBarCaret />
              </SelectTrigger>
              <SelectContent dir={lng === "he" ? "rtl" : "ltr"} className="font-ploni text-[12px]">
                <SelectItem value="relevance" dir={lng === "he" ? "rtl" : "ltr"}>{t.relevance}</SelectItem>
                <SelectItem value="price-low" dir={lng === "he" ? "rtl" : "ltr"}>{t.priceLow}</SelectItem>
                <SelectItem value="price-high" dir={lng === "he" ? "rtl" : "ltr"}>{t.priceHigh}</SelectItem>
                <SelectItem value="newest" dir={lng === "he" ? "rtl" : "ltr"}>{t.newest}</SelectItem>
              </SelectContent>
            </Select>

            {/* Filters — one control at every width, since there is now one panel. */}
            <button
              type="button"
              onClick={() => {
                if (isFilterPanelOpen) handleCloseFiltersPanel();
                else openFilterPanel();
              }}
              aria-expanded={isFilterPanelOpen}
              className={cn(COLLECTION_BAR_CONTROL)}
            >
              {t.filters}
              {countActivePanelFilters() > 0 && (
                <span className="tabular-nums">({countActivePanelFilters()})</span>
              )}
              <CollectionBarCaret />
            </button>
          </div>
        </div>

        {/* The "showing X of Y products" counter is gone, and so is the row that
            reserved height for it even when it had nothing to say — otherwise its
            mb-4 + min-h-[20px] would have stayed behind as 36px of blank band
            between the filter bar and the grid. */}
        {/* Products Grid - Full Width */}
        {/* The top rule rides this wrapper rather than the grid, because the
            virtualized listing renders one grid per row. Unconditional now, empty
            state included: COLLECTION_BAR gave up its own bottom border so this
            rule could serve as both, so suppressing it would leave the filter bar
            with no closing edge. */}
        <div className={cn("w-full", COLLECTION_GRID_TOP_RULE)}>
          {isFilterLoading ? (
            <CollectionGridSkeleton
              count={COLLECTION_LISTING_PAGE_SIZE}
              keyPrefix="filter-skeleton"
            />
          ) : sortedItems.length === 0 ? (
            <div className={cn("py-4 text-center", COLLECTION_INSET)}>
              <CubeIcon className="mx-auto h-14 w-14 text-text-secondary" />
              <h3 className="mt-2 font-ploni text-[16px] font-bold text-text-primary">
                {t.noProducts}
              </h3>
              <p className="mt-1 text-sm text-gray-500">{t.tryAdjusting}</p>
            </div>
          ) : (
            <>
              {/* Two renderings of one list. The plain grid is what the server
                  emits and what a crawler reads; the virtualized one takes over a
                  tick after hydration, at the page's initial scroll offset, so no
                  row above the viewport is ever re-measured underneath the user. */}
              {isGridVirtualized ? (
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
                        // this padding, not the grid's row-gap. It was pb-4 md:pb-2,
                        // which left a white band under every row once the cards went
                        // flush against each other.
                        className="pb-0"
                      >
                        <div className={COLLECTION_PRODUCT_GRID}>
                          {row.items.map((item, i) =>
                            renderGridItem(item, row.startIndex + i)
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div ref={gridContainerRef} className={COLLECTION_PRODUCT_GRID}>
                  {displayItems.map((entry, index) => renderGridItem(entry, index))}
                </div>
              )}

              {/* The incoming page, pre-drawn. The cards that replace these land in
                  exactly the boxes the placeholders hold, so the sentinel block
                  below does not travel and the footer stays put. */}
              {loadMoreSkeletonCount > 0 && (
                <CollectionGridSkeleton
                  count={loadMoreSkeletonCount}
                  keyPrefix="load-more-skeleton"
                />
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
                  {/* The placeholders above carry the visual load; this stays for
                      screen readers, which get nothing from an aria-hidden grid.
                      No role="status" on it - the wrapper is already the live
                      region, and nesting a second one double-announces. */}
                  <span className="sr-only">{isLoadingMore ? t.loading : ""}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Filter drawer — the shared SideDrawer, same shell as the collection
          page's and the navigation panel's. */}
      <SideDrawer
        open={isFilterPanelOpen}
        onOpenChange={(next) => {
          if (!next) handleCloseFiltersPanel();
        }}
        lng={lng}
        title={filterPanelLabels.title}
      >
        <CollectionFilterPanel
          lng={lng}
          labels={filterPanelLabels}
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
          getColorLabel={(color) => getColorName(color, lng)}
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
      </SideDrawer>

      <ScrollToTopButton lng={lng} />
    </div>
    </CollectionBrowseProvider>
  );
}

