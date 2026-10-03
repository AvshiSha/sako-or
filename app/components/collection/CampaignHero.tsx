"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

import type { Campaign } from "@/lib/firebase";
import { cn } from "@/lib/utils";

import { CAMPAIGN_HERO_FRAME, COLLECTION_INSET } from "./collectionChrome";

/**
 * The campaign banner and the campaign copy.
 *
 * Lifted out of CampaignClient so page.tsx can render it *outside* the Suspense
 * boundary that waits on the product query. That placement is the whole point:
 * the hero's height is the largest single block on the page (the frame is 125vw
 * on a phone), and while it sat inside the boundary, whatever stood in for the
 * page during loading had to either guess that height or leave it at zero.
 * Guessing is not possible — loading.tsx renders before the slug has been
 * resolved, so it cannot know whether this campaign has a banner at all, and the
 * two campaigns in the database disagree. Leaving it at zero dropped the entire
 * listing 713px (mobile) / 874px (desktop) the moment the banner painted.
 *
 * Rendered from the server's own data, the question disappears: the hero is in
 * the first paint, correct for this campaign, and nothing downstream has to
 * predict it.
 */

/** Hero video: poster, play only when in view (independent), tap-to-play when blocked on mobile. */
function CampaignHeroVideo({
  desktopVideoUrl,
  mobileVideoUrl,
  desktopPosterUrl,
  mobilePosterUrl,
}: {
  desktopVideoUrl: string | undefined;
  mobileVideoUrl: string | undefined;
  desktopPosterUrl: string | undefined;
  mobilePosterUrl: string | undefined;
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
    // Same CAMPAIGN_HERO_FRAME the image hero uses. It was h-[70vh] md:h-[80vh],
    // which made the hero's height depend on whether this campaign's banner
    // happens to be a video - 591px against the image hero's 487 on a 390x844
    // phone. One ratio for both is what lets anything upstream reason about the
    // box at all.
    <div ref={containerRef} className={cn(CAMPAIGN_HERO_FRAME, "bg-black")}>
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

/** True for the handful of extensions the admin actually stores as banners. */
function isVideoUrl(url?: string): boolean {
  if (!url) return false;
  const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".avi"];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some((ext) => lowerUrl.includes(ext));
}

export default function CampaignHero({
  campaign,
  lng,
}: {
  campaign: Campaign;
  lng: "en" | "he";
}) {
  const title = campaign.title[lng] || campaign.title.en || campaign.title.he;
  const description =
    campaign.description?.[lng] ||
    campaign.description?.en ||
    campaign.description?.he;

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

  const hasBanner =
    desktopImageUrl || desktopVideoUrl || mobileImageUrl || mobileVideoUrl;

  return (
    <>
      {hasBanner &&
        (desktopVideoUrl || mobileVideoUrl ? (
          <CampaignHeroVideo
            desktopVideoUrl={desktopVideoUrl}
            mobileVideoUrl={mobileVideoUrl}
            desktopPosterUrl={desktopImageUrl}
            mobilePosterUrl={mobileImageUrl}
          />
        ) : (
          <div className={cn(CAMPAIGN_HERO_FRAME, "bg-[#B2A28E]")}>
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
        ))}

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
    </>
  );
}
