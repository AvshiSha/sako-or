"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { motion as fmMotion, AnimatePresence } from "framer-motion";
import { FunnelIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Campaign, VariantItem } from "@/lib/firebase";
import ProductCard from "@/app/components/ProductCard";
import ScrollToTopButton from "@/app/components/ScrollToTopButton";
import { getColorName, getColorHex } from "@/lib/colors";
import { cn } from "@/lib/utils";
import {
  getCollectionState,
  setCollectionState,
  type CollectionBrowseState,
} from "@/lib/collectionBrowseStore";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/app/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Slider } from "@/app/components/ui/slider";

const motion = fmMotion as unknown as any;

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
    noProducts: "No products found for this campaign",
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
    noProducts: "לא נמצאו מוצרים במבצע זה",
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

  // Filter key from URL (all params except page and slug) for store key and reset detection
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
  const scrollRestoredRef = useRef<boolean>(false);
  const prevCampaignIdRef = useRef<string | undefined>(campaign.id);
  const prevFilterKeyRef = useRef<string>(filterKey);
  const stateSnapshotRef = useRef<{
    items: VariantItem[];
    currentPage: number;
    totalProducts: number;
    hasMore: boolean;
  } | null>(null);

  const title = campaign.title[lng] || campaign.title.en || campaign.title.he;
  const description = campaign.description?.[lng] || campaign.description?.en || campaign.description?.he;

  const safeSearchParams = searchParams ?? new URLSearchParams();

  const [selectedColors, setSelectedColors] = useState<string[]>(() => {
    const p = safeSearchParams.get("colors");
    return p ? p.split(",").filter(Boolean) : [];
  });
  const [selectedSizes, setSelectedSizes] = useState<string[]>(() => {
    const p = safeSearchParams.get("sizes");
    return p ? p.split(",").filter(Boolean) : [];
  });
  const [sortBy, setSortBy] = useState<string>(() => initialSortProp);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);
  const [desktopAccordionValue, setDesktopAccordionValue] = useState<string[]>([]);
  const [mobileAccordionValue, setMobileAccordionValue] = useState<string[]>([]);

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

  const allColors = useMemo(
    () =>
      [
        ...new Set(
          initialVariantItems
            .filter((i) => i.variant.isActive !== false && i.variant.colorSlug)
            .map((i) => i.variant.colorSlug)
            .filter(Boolean)
        ),
      ] as string[],
    [initialVariantItems]
  );
  const allSizes = useMemo(
    () =>
      [
        ...new Set(
          initialVariantItems
            .filter((i) => i.variant.isActive !== false)
            .flatMap((i) => Object.keys(i.variant.stockBySize || {}))
        ),
      ] as string[],
    [initialVariantItems]
  );
  const numericSizes = allSizes.filter((s) => /^\d+(\.\d+)?$/.test(s)).sort((a, b) => parseFloat(a) - parseFloat(b));
  const alphaSizes = allSizes.filter((s) => !/^\d+(\.\d+)?$/.test(s)).sort();
  const colorSlugToHex = useMemo(() => {
    const map: Record<string, string> = {};
    initialVariantItems.forEach((item) => {
      if (item.variant.colorSlug) {
        map[item.variant.colorSlug] = (item.variant as any).colorHex || getColorHex(item.variant.colorSlug);
      }
    });
    return map;
  }, [initialVariantItems]);

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
      router.push(`${basePath}?${qs}`, { scroll: false });
    },
    [lng, campaign.slug, currentPage, router]
  );

  const handleColorToggle = (color: string) => {
    const next = selectedColors.includes(color)
      ? selectedColors.filter((c) => c !== color)
      : [...selectedColors, color];
    setSelectedColors(next);
    updateURL({
      colors: next,
      sizes: selectedSizes,
      minPrice: String(Math.round(uiRange[0])),
      maxPrice: String(Math.round(uiRange[1])),
      sort: sortBy,
    });
  };
  const handleSizeToggle = (size: string) => {
    const next = selectedSizes.includes(size)
      ? selectedSizes.filter((s) => s !== size)
      : [...selectedSizes, size];
    setSelectedSizes(next);
    updateURL({
      colors: selectedColors,
      sizes: next,
      minPrice: String(Math.round(uiRange[0])),
      maxPrice: String(Math.round(uiRange[1])),
      sort: sortBy,
    });
  };
  const handleSliderChange = (values: number[]) => {
    const [min, max] = values;
    setUiRange([Math.min(min, max), Math.max(min, max)]);
  };
  const handleSliderCommit = (values: number[]) => {
    const [min, max] = values as [number, number];
    const final: [number, number] = [Math.min(min, max), Math.max(min, max)];
    setUiRange(final);
    updateURL({
      minPrice: String(Math.round(final[0])),
      maxPrice: String(Math.round(final[1])),
      colors: selectedColors,
      sizes: selectedSizes,
      sort: sortBy,
    });
  };
  const handlePriceReset = () => {
    const { min, max } = collectionPriceBounds;
    setUiRange([min, max]);
    updateURL({
      minPrice: "",
      maxPrice: "",
      colors: selectedColors,
      sizes: selectedSizes,
      sort: sortBy,
    });
  };
  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    updateURL({
      minPrice: String(Math.round(uiRange[0])),
      maxPrice: String(Math.round(uiRange[1])),
      colors: selectedColors,
      sizes: selectedSizes,
      sort: newSort,
    });
  };
  const handleClearFilters = () => {
    setSelectedColors([]);
    setSelectedSizes([]);
    setSortBy("relevance");
    const { min, max } = collectionPriceBounds;
    setUiRange([min, max]);
    updateURL({
      minPrice: "",
      maxPrice: "",
      colors: [],
      sizes: [],
      sort: "relevance",
    });
  };

  // Sync filter state from URL when searchParams change (e.g. back/forward, shared link)
  useEffect(() => {
    const p = searchParams ?? new URLSearchParams();
    const colorsParam = p.get("colors");
    setSelectedColors(colorsParam ? colorsParam.split(",").filter(Boolean) : []);
    const sizesParam = p.get("sizes");
    setSelectedSizes(sizesParam ? sizesParam.split(",").filter(Boolean) : []);
    const sortParam = p.get("sort");
    setSortBy(sortParam && ["price-low", "price-high", "newest", "relevance"].includes(sortParam) ? sortParam : "relevance");
    const minP = p.get("minPrice");
    const maxP = p.get("maxPrice");
    const boundsMin = collectionPriceBounds?.min ?? 0;
    const boundsMax = collectionPriceBounds?.max ?? 1000;
    const minVal = minP ? parseFloat(minP) : boundsMin;
    const maxVal = maxP ? parseFloat(maxP) : boundsMax;
    const validMin = isNaN(minVal) ? boundsMin : minVal;
    const validMax = isNaN(maxVal) ? boundsMax : maxVal;
    setUiRange([Math.min(validMin, validMax), Math.max(validMin, validMax)]);
  }, [filterKey, collectionPriceBounds?.min, collectionPriceBounds?.max]);

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

  // Hydrate from store when returning from PDP
  useEffect(() => {
    if (!campaignKey || hydratedFromStoreRef.current) return;
    const stored = getCollectionState(campaignKey);
    if (!stored) return;
    hydratedFromStoreRef.current = true;
    const items = stored.items as VariantItem[];
    if (items?.length) setVariantItems(items);
    setCurrentPage(stored.currentPage);
    setTotalProducts(stored.totalProducts);
    setHasMore(stored.hasMore);
  }, [campaignKey]);

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
    items: variantItems,
    currentPage,
    totalProducts,
    hasMore,
  };

  // Persist to store on unmount (navigating away to product page) so state is never lost
  useEffect(() => {
    return () => {
      const key = campaignKey;
      const snap = stateSnapshotRef.current;
      if (!key || !snap) return;
      const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
      setCollectionState(key, {
        useVariantItems: true,
        items: snap.items,
        currentPage: snap.currentPage,
        totalProducts: snap.totalProducts,
        hasMore: snap.hasMore,
        scrollY,
        updatedAt: Date.now(),
      });
    };
  }, [campaignKey]);

  // Helper to persist current campaign state (including scrollY) into the store
  const persistCampaignState = useCallback(
    (scrollYOverride?: number) => {
      if (!campaignKey) return;
      const scrollY =
        typeof window !== "undefined"
          ? scrollYOverride ?? window.scrollY
          : scrollYOverride ?? 0;
      const state: CollectionBrowseState = {
        useVariantItems: true,
        items: variantItems,
        currentPage,
        totalProducts,
        hasMore,
        scrollY,
        updatedAt: Date.now(),
      };
      setCollectionState(campaignKey, state);
    },
    [campaignKey, variantItems, currentPage, totalProducts, hasMore]
  );

  // Persist scroll position while the user scrolls (debounced)
  useEffect(() => {
    if (!campaignKey) return;
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => persistCampaignState(), 100);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [campaignKey, persistCampaignState]);

  // Persist when pagination state changes
  useEffect(() => {
    if (!campaignKey) return;
    persistCampaignState();
  }, [campaignKey, persistCampaignState, variantItems.length, currentPage, totalProducts, hasMore]);

  // Scroll restoration when returning from PDP
  useEffect(() => {
    if (!campaignKey || scrollRestoredRef.current) return;
    const stored = getCollectionState(campaignKey);
    if (!stored || stored.scrollY <= 0) {
      scrollRestoredRef.current = true;
      return;
    }
    if (variantItems.length === 0) return;

    scrollRestoredRef.current = true;
    const targetY = stored.scrollY;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, targetY);
      });
    });
  }, [campaignKey, variantItems.length]);

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
          if (typeof window !== "undefined") {
            window.scrollTo({ top: scrollYBefore, left: scrollXBefore, behavior: "auto" });
          }
        });
      });
    } catch (e) {
      console.error("Campaign load more error:", e);
      requestAnimationFrame(() => {
        if (typeof window !== "undefined") {
          window.scrollTo({ top: scrollYBefore, left: scrollXBefore, behavior: "auto" });
        }
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, currentPage, lng, campaign.slug, totalProducts, searchParams]);

  return (
    <div className="min-h-screen bg-white">
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
            <div className="relative w-full overflow-hidden bg-[#8B1E1E] aspect-[4/5] md:aspect-[21/9]">
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

      {/* Description Section */}
      {description && (
        <div className={`max-w-4xl mx-auto px-4 md:px-8 py-8 ${lng === "he" ? "text-right" : "text-left"}`}>
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {description}
            </p>
          </div>
        </div>
      )}

      {/* Products Grid Section with Filters */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-10 pb-8 md:pt-32 md:pb-8">
        <div className={cn("flex items-center gap-3 mb-4", lng === "he" ? "flex-row-reverse" : "flex-row")}>
          <button
            onClick={() => setDesktopFiltersOpen(!desktopFiltersOpen)}
            className="hidden md:inline-flex items-center px-4 py-2 text-sm font-medium text-black bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors duration-200"
          >
            <FunnelIcon className={cn("h-4 w-4", lng === "he" ? "ml-2" : "mr-2")} />
            {t.filters}
            {(() => {
              const [currentMin, currentMax] = uiRange;
              const boundsMin = collectionPriceBounds?.min ?? 0;
              const boundsMax = collectionPriceBounds?.max ?? 1000;
              const hasPriceFilter = currentMin > boundsMin || currentMax < boundsMax;
              const count = selectedColors.length + selectedSizes.length + (hasPriceFilter ? 1 : 0);
              if (count > 0) {
                return (
                  <span className={cn("bg-black text-white text-xs rounded-full px-2 py-1", lng === "he" ? "mr-2" : "ml-2")}>
                    {count}
                  </span>
                );
              }
              return null;
            })()}
          </button>
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="md:hidden inline-flex items-center px-4 py-2 text-sm font-medium text-black bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors duration-200"
          >
            <FunnelIcon className={cn("h-4 w-4", lng === "he" ? "ml-1" : "mr-1")} />
            {t.filters}
            {(() => {
              const [currentMin, currentMax] = uiRange;
              const boundsMin = collectionPriceBounds?.min ?? 0;
              const boundsMax = collectionPriceBounds?.max ?? 1000;
              const hasPriceFilter = currentMin > boundsMin || currentMax < boundsMax;
              const count = selectedColors.length + selectedSizes.length + (hasPriceFilter ? 1 : 0);
              if (count > 0) {
                return (
                  <span className={cn("bg-black text-white text-xs rounded-full px-2 py-1", lng === "he" ? "mr-2" : "ml-2")}>
                    {count}
                  </span>
                );
              }
              return null;
            })()}
          </button>
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className={cn("w-full sm:w-auto text-black md:py-3 md:px-4", lng === "he" && "md:ml-auto")} dir={lng === "he" ? "rtl" : "ltr"}>
              <SelectValue placeholder={t.relevance} />
            </SelectTrigger>
            <SelectContent dir={lng === "he" ? "rtl" : "ltr"}>
              <SelectItem value="relevance" dir={lng === "he" ? "rtl" : "ltr"}>{t.relevance}</SelectItem>
              <SelectItem value="price-low" dir={lng === "he" ? "rtl" : "ltr"}>{t.priceLow}</SelectItem>
              <SelectItem value="price-high" dir={lng === "he" ? "rtl" : "ltr"}>{t.priceHigh}</SelectItem>
              <SelectItem value="newest" dir={lng === "he" ? "rtl" : "ltr"}>{t.newest}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {sortedItems.length > 0 && (
          <div className="mb-4 text-sm text-gray-600">
            {t.showing} {variantItems.length} {t.of} {totalProducts} {t.items}
          </div>
        )}

        {sortedItems.length === 0 ? (
          <div className={cn("text-center py-12", lng === "he" ? "text-right" : "text-left")}>
            <p className="text-gray-500 text-lg">{t.noProducts}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-2">
              {sortedItems.map((item) => (
                <ProductCard
                  key={item.variantKey}
                  product={item.product}
                  language={lng}
                  preselectedColorSlug={item.variant.colorSlug}
                />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  disabled={isLoadingMore}
                  onClick={handleLoadMore}
                  className={cn(
                    "px-6 py-3 bg-[#856D55] text-white font-medium rounded-md transition-colors duration-200",
                    "hover:bg-[#856D55]/90 disabled:opacity-50 disabled:cursor-not-allowed",
                    isLoadingMore && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isLoadingMore ? t.loading : t.loadMore}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Desktop Filter Sidebar */}
      <AnimatePresence>
        {desktopFiltersOpen && (
          <>
            <div className="fixed inset-0 z-[68] bg-black/30" onClick={() => setDesktopFiltersOpen(false)} />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-80 bg-white shadow-2xl z-[70]"
            >
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                  <h2 className="text-lg font-light text-black tracking-wider uppercase">{t.filters}</h2>
                  <button onClick={() => setDesktopFiltersOpen(false)} className="text-black hover:text-gray-600">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <Accordion type="multiple" value={desktopAccordionValue} onValueChange={setDesktopAccordionValue} className="space-y-6">
                    <AccordionItem value="price" className="border border-gray-200 rounded-lg">
                      <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                        <h3 className="text-sm font-medium text-black">{t.price}</h3>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-4 pt-3 border-t border-gray-100">
                          <div className="text-sm font-medium text-gray-900">
                            ₪{formatPrice(uiRange[0])} - ₪{formatPrice(uiRange[1])}
                          </div>
                          <div className="px-2">
                            <Slider
                              value={uiRange}
                              onValueChange={handleSliderChange}
                              onValueCommit={handleSliderCommit}
                              min={Math.max(0, Math.floor((collectionPriceBounds.min - 200) / 10) * 10)}
                              max={Math.ceil((collectionPriceBounds.max + 200) / 10) * 10}
                              step={10}
                              className="w-full"
                              dir={lng === "he" ? "rtl" : "ltr"}
                            />
                          </div>
                          {(uiRange[0] !== collectionPriceBounds.min || uiRange[1] !== collectionPriceBounds.max) && (
                            <button onClick={handlePriceReset} className="text-xs text-gray-600 hover:text-gray-800 underline">
                              {lng === "he" ? "איפוס" : "Reset"}
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
                              className={cn(
                                "w-full flex items-center space-x-3 p-2 rounded-sm transition-all duration-200",
                                selectedColors.includes(color) ? "bg-gray-100 border border-gray-300" : "hover:bg-gray-100 border border-transparent"
                              )}
                            >
                              <div className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: colorSlugToHex[color] || getColorHex(color) }} />
                              <span className="text-sm font-light text-black">{getColorName(color, lng)}</span>
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
                                    className={cn(
                                      "p-2 rounded-sm transition-all duration-200 text-center",
                                      selectedSizes.includes(size) ? "bg-gray-100 border border-gray-300" : "hover:bg-gray-100 border border-transparent"
                                    )}
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
                                    className={cn(
                                      "p-2 rounded-sm transition-all duration-200 text-center",
                                      selectedSizes.includes(size) ? "bg-gray-100 border border-gray-300" : "hover:bg-gray-100 border border-transparent"
                                    )}
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
                  </Accordion>
                  {(selectedColors.length > 0 || selectedSizes.length > 0 || uiRange[0] > (collectionPriceBounds?.min ?? 0) || uiRange[1] < (collectionPriceBounds?.max ?? 1000)) && (
                    <div className="mb-6 mt-6">
                      <button onClick={handleClearFilters} className="w-full py-2 px-4 text-sm font-light text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-200 border border-gray-200 rounded-sm">
                        {t.clearAllFilters}
                      </button>
                    </div>
                  )}
                </div>
                <div className="p-6 border-t border-gray-100">
                  <button onClick={() => setDesktopFiltersOpen(false)} className="w-full py-3 px-4 bg-[#856D55]/90 text-white text-sm font-light tracking-wider uppercase hover:bg-[#856D55] transition-colors duration-200">
                    {t.applyFilters}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Filter Drawer */}
      <AnimatePresence>
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-[70] md:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/30" onClick={() => setMobileFiltersOpen(false)} />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 h-full w-80 bg-white shadow-xl z-[71]"
            >
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                  <h2 className="text-lg font-light text-black tracking-wider uppercase">{t.filters}</h2>
                  <button onClick={() => setMobileFiltersOpen(false)} className="text-black hover:text-gray-600">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <Accordion type="multiple" value={mobileAccordionValue} onValueChange={setMobileAccordionValue} className="space-y-6">
                    <AccordionItem value="price" className="border border-gray-200 rounded-lg">
                      <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                        <h3 className="text-sm font-medium text-black">{t.price}</h3>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-4 pt-3 border-t border-gray-100">
                          <div className="text-sm font-medium text-gray-900">₪{formatPrice(uiRange[0])} - ₪{formatPrice(uiRange[1])}</div>
                          <div className="px-2">
                            <Slider value={uiRange} onValueChange={handleSliderChange} onValueCommit={handleSliderCommit} min={Math.max(0, Math.floor((collectionPriceBounds.min - 200) / 10) * 10)} max={Math.ceil((collectionPriceBounds.max + 200) / 10) * 10} step={10} className="w-full" dir={lng === "he" ? "rtl" : "ltr"} />
                          </div>
                          {(uiRange[0] !== collectionPriceBounds.min || uiRange[1] !== collectionPriceBounds.max) && (
                            <button onClick={handlePriceReset} className="text-xs text-gray-600 hover:text-gray-800 underline">{lng === "he" ? "איפוס" : "Reset"}</button>
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
                            <button key={color} onClick={() => handleColorToggle(color)} className={cn("w-full flex items-center space-x-3 p-2 rounded-sm transition-all duration-200", selectedColors.includes(color) ? "bg-gray-100 border border-gray-300" : "hover:bg-gray-100 border border-transparent")}>
                              <div className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: colorSlugToHex[color] || getColorHex(color) }} />
                              <span className="text-sm font-light text-black">{getColorName(color, lng)}</span>
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
                                  <button key={size} onClick={() => handleSizeToggle(size)} className={cn("p-2 rounded-sm transition-all duration-200 text-center", selectedSizes.includes(size) ? "bg-gray-100 border border-gray-300" : "hover:bg-gray-100 border border-transparent")}>
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
                                  <button key={size} onClick={() => handleSizeToggle(size)} className={cn("p-2 rounded-sm transition-all duration-200 text-center", selectedSizes.includes(size) ? "bg-gray-100 border border-gray-300" : "hover:bg-gray-100 border border-transparent")}>
                                    <span className="text-sm font-light text-black">{size}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  {(selectedColors.length > 0 || selectedSizes.length > 0 || uiRange[0] > (collectionPriceBounds?.min ?? 0) || uiRange[1] < (collectionPriceBounds?.max ?? 1000)) && (
                    <div className="mb-6 mt-6">
                      <button onClick={handleClearFilters} className="w-full py-2 px-4 text-sm font-light text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-200 border border-gray-200 rounded-sm">
                        {t.clearAllFilters}
                      </button>
                    </div>
                  )}
                </div>
                <div className="p-6 border-t border-gray-100">
                  <button onClick={() => setMobileFiltersOpen(false)} className="w-full py-3 px-4 bg-[#856D55]/90 text-white text-sm font-light tracking-wider uppercase hover:bg-[#856D55] transition-colors duration-200">
                    {t.applyFilters}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ScrollToTopButton lng={lng} />
    </div>
  );
}

