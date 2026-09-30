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
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion as fmMotion, AnimatePresence } from "framer-motion";
import { CubeIcon } from "@heroicons/react/24/outline";
import { Campaign, VariantItem } from "@/lib/firebase";
import ProductCard from "@/app/components/ProductCard";
import CollectionProductCardSkeleton from "@/app/components/CollectionProductCardSkeleton";
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
  COLLECTION_RETURN_EVENT,
  readLastCollectionScroll,
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
import {
  COLLECTION_BAR,
  COLLECTION_BAR_CONTROL,
  COLLECTION_GRID_BREAKPOINTS,
  COLLECTION_GRID_ROW_EXTRA_HEIGHT_PX,
  COLLECTION_GRID_ROW_GAP_PX,
  COLLECTION_INSET,
  COLLECTION_LISTING_PAGE_SIZE,
  COLLECTION_PRODUCT_GRID,
  CollectionBarCaret,
} from "@/app/components/collection/collectionChrome";
import { useResponsiveColumnCount } from "@/lib/useResponsiveColumnCount";
import { useProductGridVirtualizer } from "@/lib/useProductGridVirtualizer";
import { useCollectionInfiniteScroll } from "@/lib/useCollectionInfiniteScroll";

const motion = fmMotion as unknown as any;

/**
 * A campaign is a hand-picked set of products rather than a branch of the category
 * tree, so the shared filter panel's sub-category section is switched off here. The
 * collection listing is the only surface that has one to show.
 */
const CAMPAIGN_NO_SUBCATEGORY_FILTER: Pick<
  CollectionFilterPanelProps,
  | "showSubSubCategoryFilter"
  | "subSubCategoriesByParent"
  | "selectedSubSubCategories"
  | "onSubSubCategoryToggle"
  | "getParentCategoryName"
  | "getSubSubCategoryName"
> = {
  showSubSubCategoryFilter: false,
  subSubCategoriesByParent: {},
  selectedSubSubCategories: [],
  onSubSubCategoryToggle: () => {},
  getParentCategoryName: () => "",
  getSubSubCategoryName: () => "",
};

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

/** Hero video: poster, play only when in view (independent), tap-to-play when blocked on mobile. */
function CampaignHeroVideo({
  desktopVideoUrl,
  mobileVideoUrl,
  desktopPosterUrl,
  mobilePosterUrl,
  title,
}: {
  desktopVideoUrl: string | undefined;
  mobileVideoUrl: string | undefined;
  desktopPosterUrl: string | undefined;
  mobilePosterUrl: string | undefined;
  title: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const desktopRef = useRef<HTMLVideoElement>(null);
  const mobileRef = useRef<HTMLVideoElement>(null);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => setIsInView(entry.isIntersecting));
      },
      { threshold: 0.25, rootMargin: "0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const playCurrent = useCallback(async () => {
    const video = isMobile ? mobileRef.current : desktopRef.current;
    if (!video) return;
    try {
      await video.play();
      setShowPlayButton(false);
    } catch {
      setShowPlayButton(true);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isInView) {
      desktopRef.current?.pause();
      mobileRef.current?.pause();
      return;
    }
    const video = isMobile ? mobileRef.current : desktopRef.current;
    if (!video) return;
    const p = video.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => setShowPlayButton(true));
    }
  }, [isInView, isMobile]);

  useEffect(() => {
    const video = isMobile ? mobileRef.current : desktopRef.current;
    if (!video) return;
    const onPlaying = () => setShowPlayButton(false);
    video.addEventListener("playing", onPlaying);
    return () => video.removeEventListener("playing", onPlaying);
  }, [isMobile]);

  const hasDesktop = !!desktopVideoUrl;
  const hasMobile = !!mobileVideoUrl;
  if (!hasDesktop && !hasMobile) return null;

  return (
    <div ref={containerRef} className="relative w-full h-[70vh] md:h-[80vh] overflow-hidden bg-black">
      <div
        className={cn(
          "absolute inset-0 flex md:block items-center justify-center md:overflow-hidden",
          showPlayButton ? "z-10" : "z-0"
        )}
      >
        {hasDesktop && (
          <video
            ref={desktopRef}
            className="hidden md:block absolute inset-0 w-full h-full object-cover"
            muted
            loop
            playsInline
            preload="metadata"
            poster={desktopPosterUrl}
            aria-hidden="true"
          >
            <source src={desktopVideoUrl} type="video/mp4" />
          </video>
        )}
        {hasMobile && (
          <video
            ref={mobileRef}
            className="block md:hidden absolute inset-0 w-full h-full object-cover"
            muted
            loop
            playsInline
            preload="metadata"
            poster={mobilePosterUrl}
            aria-hidden="true"
          >
            <source src={mobileVideoUrl} type="video/mp4" />
          </video>
        )}
        {showPlayButton && (
          <button
            type="button"
            onClick={playCurrent}
            className="md:hidden absolute inset-0 flex items-center justify-center z-10 bg-black/30 focus:outline-none focus:ring-2 focus:ring-white/50 rounded-none"
            aria-label="Play video"
          >
            <span className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-neutral-900 ml-1" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7L8 5z" />
              </svg>
            </span>
          </button>
        )}
        <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
      </div>
    </div>
  );
}

interface CampaignClientProps {
  campaign: Campaign;
  initialVariantItems: VariantItem[];
  /** Stable filter options from full campaign so the filter list does not collapse after selection */
  initialAvailableFilterOptions?: { colors: string[]; sizes: string[] };
  totalProducts?: number;
  hasMore?: boolean;
  lng: "en" | "he";
  initialSort?: string;
  initialMinPrice?: string;
  initialMaxPrice?: string;
}

export default function CampaignClient({
  campaign,
  initialVariantItems,
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

  const title = campaign.title[lng] || campaign.title.en || campaign.title.he;
  const description = campaign.description?.[lng] || campaign.description?.en || campaign.description?.he;

  const safeSearchParams = searchParams ?? new URLSearchParams();

  const urlFilterState = useMemo(
    () => readFilterUiStateFromSearchParams(safeSearchParams, undefined),
    [filterKey]
  );
  const selectedColors = urlFilterState.colors;
  const selectedSizes = urlFilterState.sizes;
  const sortBy = urlFilterState.sort;
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);
  const isFilterPanelOpen = mobileFiltersOpen || desktopFiltersOpen;
  type FilterDraft = {
    colors: string[];
    sizes: string[];
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

  const basePath = `/${lng}/collection/campaign`;
  const updateURL = useCallback(
    (
      newFilters: {
        colors?: string[];
        sizes?: string[];
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

      // IMPORTANT: do not wrap this in flushSync. This flag swaps the entire
      // (potentially large, infinite-scroll-accumulated) product grid out for
      // skeleton placeholders. flushSync would force that whole subtree teardown
      // to happen synchronously, inline, on the current call stack — React's
      // commit-phase deletion-effects walk recurses one JS stack frame per
      // unmounted DOM node, and on a big grid this can exceed WebKit's (Safari/iOS)
      // much shallower call stack, throwing "RangeError: Maximum call stack size
      // exceeded". A plain state update lets React schedule the commit normally
      // (on a fresh stack) instead. See CollectionClient.tsx for the same fix.
      markCollectionFilterNavPending();
      setIsFilterNavigating(true);
      startFilterTransition(() => {
        router.push(newUrl, { scroll: false });
      });
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
  const panelUiRange = filterDraft?.uiRange ?? uiRange;

  const handleCloseFiltersPanel = () => {
    const fromUrl = readFilterUiStateFromSearchParams(
      safeSearchParams,
      collectionPriceBounds
    );
    setUiRange(fromUrl.uiRange);
    setFilterDraft(null);
    setMobileFiltersOpen(false);
    setDesktopFiltersOpen(false);
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
      sort: sortBy,
    });
    setUiRange(filterDraft.uiRange);
    setFilterDraft(null);
    setMobileFiltersOpen(false);
    setDesktopFiltersOpen(false);
  };

  const openFilterPanel = (target: "mobile" | "desktop") => {
    const fromUrl = readFilterUiStateFromSearchParams(
      safeSearchParams,
      collectionPriceBounds
    );
    setFilterDraft({
      colors: [...fromUrl.colors],
      sizes: [...fromUrl.sizes],
      uiRange: fromUrl.uiRange,
    });
    setUiRange(fromUrl.uiRange);
    if (target === "mobile") setMobileFiltersOpen(true);
    else setDesktopFiltersOpen(true);
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
    updateURL({ colors: next, sizes: selectedSizes, minPrice, maxPrice, sort: sortBy });
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
    updateURL({ colors: selectedColors, sizes: next, minPrice, maxPrice, sort: sortBy });
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
      sort: sortBy,
    });
  };

  const handleClearFilters = () => {
    const { min, max } = collectionPriceBounds;
    if (isFilterPanelOpen) {
      setFilterDraft({ colors: [], sizes: [], uiRange: [min, max] });
      return;
    }
    setUiRange([min, max]);
    updateURL({
      minPrice: "",
      maxPrice: "",
      colors: [],
      sizes: [],
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
    (item: VariantItem): string => item.variantKey,
    []
  );
  const gridColumns = useResponsiveColumnCount(COLLECTION_GRID_BREAKPOINTS);
  const {
    containerRef: gridContainerRef,
    rows: gridRows,
    virtualItems: gridVirtualItems,
    totalSize: gridTotalSize,
    measureElement: measureGridRow,
  } = useProductGridVirtualizer<VariantItem>({
    items: sortedItems,
    columns: gridColumns,
    getItemKey: getGridItemKey,
    extraRowHeightPx: COLLECTION_GRID_ROW_EXTRA_HEIGHT_PX,
    rowGapPx: COLLECTION_GRID_ROW_GAP_PX,
  });

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
      panelColors.length + panelSizes.length + (hasPriceFilter ? 1 : 0)
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

  // Helper to check if a URL is a video
  const isVideoUrl = (url?: string): boolean => {
    if (!url) return false;
    const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".avi"];
    const lowerUrl = url.toLowerCase();
    return videoExtensions.some((ext) => lowerUrl.includes(ext));
  };

  // Determine if we have video or image content
  const desktopVideoUrl =
    campaign.bannerDesktopVideoUrl ||
    (isVideoUrl(campaign.bannerDesktopUrl) ? campaign.bannerDesktopUrl : undefined);
  const mobileVideoUrl =
    campaign.bannerMobileVideoUrl ||
    (isVideoUrl(campaign.bannerMobileUrl) ? campaign.bannerMobileUrl : undefined);
  const desktopImageUrl =
    campaign.bannerDesktopUrl && !isVideoUrl(campaign.bannerDesktopUrl)
      ? campaign.bannerDesktopUrl
      : undefined;
  const mobileImageUrl =
    campaign.bannerMobileUrl && !isVideoUrl(campaign.bannerMobileUrl)
      ? campaign.bannerMobileUrl
      : undefined;

  const hasDesktopBanner = desktopImageUrl || desktopVideoUrl;
  const hasMobileBanner = mobileImageUrl || mobileVideoUrl;

  // Load more: pass all current filter params so API returns next page of filtered set
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    const scrollYBefore = typeof window !== "undefined" ? window.scrollY : 0;
    const scrollXBefore = typeof window !== "undefined" ? window.scrollX : 0;
    // These restores land a frame or more later. If the user clicked a product
    // card in the meantime, the frames run on the product page - re-applying
    // this offset there is exactly the mid-page landing we're fixing.
    const pathBefore = typeof window !== "undefined" ? window.location.pathname : "";
    const stillOnSamePage = () =>
      typeof window !== "undefined" && window.location.pathname === pathBefore;
    const nextPage = currentPage + 1;
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
      if (nextItems.length > 0) {
        setVariantItems((prev) => {
          const existingKeys = new Set(prev.map((i) => i.variantKey));
          const newItems = nextItems.filter((i) => !existingKeys.has(i.variantKey));
          return [...prev, ...newItems];
        });
      }
      setCurrentPage(data.page ?? nextPage);
      setTotalProducts(data.total ?? totalProducts);
      setHasMore(Boolean(data.hasMore));

      const urlParams = new URLSearchParams((searchParams ?? new URLSearchParams()).toString());
      urlParams.set("page", String(nextPage));
      const newUrl = `${basePath}?${urlParams.toString()}`;
      if (typeof window !== "undefined") {
        window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, "", newUrl);
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (stillOnSamePage()) {
            window.scrollTo({ top: scrollYBefore, left: scrollXBefore, behavior: "auto" });
          }
        });
      });
    } catch (e) {
      console.error("Campaign load more error:", e);
      requestAnimationFrame(() => {
        if (stillOnSamePage()) {
          window.scrollTo({ top: scrollYBefore, left: scrollXBefore, behavior: "auto" });
        }
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, currentPage, lng, campaign.slug, totalProducts, searchParams]);

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
    <div className="min-h-screen bg-white">
      {isFilterLoading && <Loader label={t.loadingProducts} />}
      {/* Hero Section - video plays only when in view; tap-to-play on mobile when blocked */}
      {(hasDesktopBanner || hasMobileBanner) && (
        <>
          {(desktopVideoUrl || mobileVideoUrl) ? (
            <CampaignHeroVideo
              desktopVideoUrl={desktopVideoUrl}
              mobileVideoUrl={mobileVideoUrl}
              desktopPosterUrl={desktopImageUrl}
              mobilePosterUrl={mobileImageUrl}
              title={title}
            />
          ) : (
            <div className="relative w-full overflow-hidden bg-[#B2A28E] aspect-[4/5] md:aspect-[21/9]">
              {desktopImageUrl && (
                <div className="hidden md:block absolute inset-0">
                  <Image
                    src={desktopImageUrl}
                    alt=""
                    fill
                    priority
                    className="object-cover object-center"
                    sizes="100vw"
                  />
                </div>
              )}
              {mobileImageUrl && (
                <div className="md:hidden absolute inset-0">
                  <Image
                    src={mobileImageUrl}
                    alt=""
                    fill
                    priority
                    className="object-contain object-bottom"
                    sizes="100vw"
                  />
                </div>
              )}
              {!desktopImageUrl && mobileImageUrl && (
                <div className="hidden md:block absolute inset-0">
                  <Image src={mobileImageUrl} alt={title} fill priority className="object-cover" sizes="100vw" />
                </div>
              )}
              {!mobileImageUrl && desktopImageUrl && (
                <div className="md:hidden absolute inset-0">
                  <Image src={desktopImageUrl} alt={title} fill priority className="object-cover" sizes="100vw" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/30" />
            </div>
          )}
        </>
      )}

      {/* Campaign copy. This design system has no `prose`: the text is set in the
          listing's own body type and inset to the same gutter as the title, and it
          keeps the campaign's own line breaks. */}
      {description && (
        <div
          className={cn(
            "pt-8 font-ploni text-[16px] leading-[24px] text-text-primary",
            COLLECTION_INSET,
            lng === "he" ? "text-right" : "text-left"
          )}
          dir={lng === "he" ? "rtl" : "ltr"}
        >
          <p className="whitespace-pre-line">{description}</p>
        </div>
      )}

      {/* Full-bleed shell, 438:2962 - the same one the collection listing uses. The
          max-w-7xl container that used to wrap this page is gone: the grid and the
          filter bar run to the viewport edge, and the blocks that are NOT meant to
          bleed carry COLLECTION_INSET themselves. */}
      <div
        className={cn(
          "relative w-full pt-8 pb-6 md:pb-16",
          isFilterLoading && "pointer-events-none"
        )}
        aria-busy={isFilterLoading}
      >
        <div className="mb-4 md:mb-4">
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
            `${t.showing} ${variantItems.length} ${t.of} ${totalProducts} ${t.items}`}
        </div>

        {/* Products Grid - Full Width */}
        <div className="w-full">
          {isFilterLoading ? (
            <div className={COLLECTION_PRODUCT_GRID} aria-busy="true">
              {Array.from({ length: COLLECTION_LISTING_PAGE_SIZE }).map((_, index) => (
                <div key={`skeleton-${index}`}>
                  <CollectionProductCardSkeleton />
                </div>
              ))}
            </div>
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
                        {row.items.map((item, i) => {
                          const flatIndex = row.startIndex + i;
                          return (
                            <div
                              key={item.variantKey}
                              data-collection-anchor={item.variantKey}
                            >
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
                        })}
                      </div>
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

            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 z-[70] h-full w-full max-w-[501px] bg-surface-primary shadow-2xl"
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
                {...CAMPAIGN_NO_SUBCATEGORY_FILTER}
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
                {...CAMPAIGN_NO_SUBCATEGORY_FILTER}
                onApply={handleApplyFilters}
                onClear={handleClearFilters}
                onClose={handleCloseFiltersPanel}
                isBusy={isFilterLoading}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ScrollToTopButton lng={lng} />
    </div>
    </CollectionBrowseProvider>
  );
}

