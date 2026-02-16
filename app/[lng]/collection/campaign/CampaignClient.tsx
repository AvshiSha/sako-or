"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { Campaign, VariantItem } from "@/lib/firebase";
import ProductCard from "@/app/components/ProductCard";
import ScrollToTopButton from "@/app/components/ScrollToTopButton";
import { cn } from "@/lib/utils";
import {
  getCollectionState,
  setCollectionState,
  type CollectionBrowseState,
} from "@/lib/collectionBrowseStore";

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
}

export default function CampaignClient({
  campaign,
  initialVariantItems,
  totalProducts: initialTotal,
  hasMore: initialHasMore = false,
  lng,
}: CampaignClientProps) {
  const [variantItems, setVariantItems] = useState<VariantItem[]>(initialVariantItems);
  const [totalProducts, setTotalProducts] = useState(initialTotal ?? initialVariantItems.length);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Stable key for this campaign (for back-navigation state restore)
  const campaignKey = useMemo(
    () => `campaign:${lng}:${campaign.id}`,
    [lng, campaign.id]
  );

  const hydratedFromStoreRef = useRef<boolean>(false);
  const scrollRestoredRef = useRef<boolean>(false);
  const prevCampaignIdRef = useRef<string | undefined>(campaign.id);
  const stateSnapshotRef = useRef<{
    items: VariantItem[];
    currentPage: number;
    totalProducts: number;
    hasMore: boolean;
  } | null>(null);

  const title = campaign.title[lng] || campaign.title.en || campaign.title.he;
  const description = campaign.description?.[lng] || campaign.description?.en || campaign.description?.he;

  // Hydrate from store when returning from PDP (same as CollectionClient)
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

  // Sync from server when campaign or initial data changes (do NOT overwrite when we hydrated from store)
  useEffect(() => {
    if (prevCampaignIdRef.current !== campaign.id) {
      prevCampaignIdRef.current = campaign.id;
      hydratedFromStoreRef.current = false;
    }
    if (hydratedFromStoreRef.current) return;

    setVariantItems(initialVariantItems);
    setTotalProducts(initialTotal ?? initialVariantItems.length);
    setHasMore(initialHasMore ?? false);
    setCurrentPage(1);
  }, [campaign.id, initialVariantItems, initialTotal, initialHasMore]);

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

  // Load more campaign variant items (same as collection page); preserve scroll after append
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
      if (campaign.slug) params.set("slug", campaign.slug);
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

      // Restore scroll position after React renders new items (same as CollectionClient)
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
  }, [isLoadingMore, hasMore, currentPage, lng, campaign.slug, totalProducts]);

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

      {/* Products Grid Section */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-32 pb-8 md:pt-24 md:pb-8">
        {variantItems.length === 0 ? (
          <div className={`text-center py-12 ${lng === "he" ? "text-right" : "text-left"}`}>
            <p className="text-gray-500 text-lg">
              {lng === "he"
                ? "לא נמצאו מוצרים במבצע זה"
                : "No products found for this campaign"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-2">
              {variantItems.map((item) => (
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
                  {isLoadingMore
                    ? (lng === "he" ? "טוען..." : "Loading...")
                    : lng === "he"
                      ? "טען עוד"
                      : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <ScrollToTopButton lng={lng} />
    </div>
  );
}

