"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Campaign, Product } from "@/lib/firebase";
import ProductCard from "@/app/components/ProductCard";

interface CampaignClientProps {
  campaign: Campaign;
  products: Product[];
  lng: "en" | "he";
}

export default function CampaignClient({
  campaign,
  products,
  lng,
}: CampaignClientProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const title = campaign.title[lng] || campaign.title.en || campaign.title.he;
  const subtitle = campaign.subtitle?.[lng] || campaign.subtitle?.en || campaign.subtitle?.he;
  const description = campaign.description?.[lng] || campaign.description?.en || campaign.description?.he;

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

  // Helper to check if a URL is a video
  const isVideoUrl = (url?: string): boolean => {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
    const lowerUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowerUrl.includes(ext));
  };

  // Determine if we have video or image content
  // Check both dedicated video fields and image fields (in case video was uploaded to image field)
  const desktopVideoUrl = campaign.bannerDesktopVideoUrl || (isVideoUrl(campaign.bannerDesktopUrl) ? campaign.bannerDesktopUrl : undefined);
  const mobileVideoUrl = campaign.bannerMobileVideoUrl || (isVideoUrl(campaign.bannerMobileUrl) ? campaign.bannerMobileUrl : undefined);
  const desktopImageUrl = campaign.bannerDesktopUrl && !isVideoUrl(campaign.bannerDesktopUrl) ? campaign.bannerDesktopUrl : undefined;
  const mobileImageUrl = campaign.bannerMobileUrl && !isVideoUrl(campaign.bannerMobileUrl) ? campaign.bannerMobileUrl : undefined;
  
  const hasDesktopVideo = desktopVideoUrl && desktopVideoUrl.trim().length > 0;
  const hasMobileVideo = mobileVideoUrl && mobileVideoUrl.trim().length > 0;
  const hasDesktopBanner = desktopImageUrl || desktopVideoUrl;
  const hasMobileBanner = mobileImageUrl || mobileVideoUrl;

  // Debug: Log campaign data to check if video URL is present
  useEffect(() => {
    console.log('Campaign data:', {
      bannerDesktopVideoUrl: campaign.bannerDesktopVideoUrl,
      bannerMobileVideoUrl: campaign.bannerMobileVideoUrl,
      bannerDesktopUrl: campaign.bannerDesktopUrl,
      bannerMobileUrl: campaign.bannerMobileUrl,
      hasDesktopVideo,
      hasMobileVideo
    });
  }, [campaign.bannerDesktopVideoUrl, campaign.bannerMobileVideoUrl, hasDesktopVideo, hasMobileVideo]);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative w-full h-[70vh] md:h-[80vh] overflow-hidden">
        {hasDesktopBanner || hasMobileBanner ? (
          <>
            {/* Desktop Video (priority) */}
            {hasDesktopVideo && desktopVideoUrl && (
              <div className="hidden md:block absolute inset-0">
                <video
                  key={desktopVideoUrl}
                  src={desktopVideoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  crossOrigin="anonymous"
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    console.error('Desktop video load error:', desktopVideoUrl, e);
                    const target = e.target as HTMLVideoElement;
                    console.error('Video error details:', {
                      error: target.error,
                      networkState: target.networkState,
                      readyState: target.readyState
                    });
                  }}
                  onLoadedData={() => {
                    console.log('Desktop video loaded successfully:', desktopVideoUrl);
                  }}
                />
              </div>
            )}
            {/* Desktop Image (fallback if no video) */}
            {!hasDesktopVideo && desktopImageUrl && (
              <div className="hidden md:block absolute inset-0">
                <Image
                  src={desktopImageUrl}
                  alt=""
                  fill
                  priority
                  className="object-cover"
                  sizes="100vw"
                />
              </div>
            )}
            {/* Mobile Video (priority) */}
            {hasMobileVideo && mobileVideoUrl && (
              <div className="md:hidden absolute inset-0">
                <video
                  key={mobileVideoUrl}
                  src={mobileVideoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error('Mobile video load error:', mobileVideoUrl, e);
                    const target = e.target as HTMLVideoElement;
                    console.error('Video error details:', {
                      error: target.error,
                      networkState: target.networkState,
                      readyState: target.readyState
                    });
                  }}
                  onLoadedData={() => {
                    console.log('Mobile video loaded successfully:', mobileVideoUrl);
                  }}
                />
              </div>
            )}
            {/* Mobile Image (fallback if no video) */}
            {!hasMobileVideo && mobileImageUrl && (
              <div className="md:hidden absolute inset-0">
                <Image
                  src={mobileImageUrl}
                  alt=""
                  fill
                  priority
                  className="object-cover"
                  sizes="100vw"
                />
              </div>
            )}
            {/* Fallback: Use mobile video/image for desktop if desktop not available */}
            {!hasDesktopVideo && !desktopImageUrl && hasMobileVideo && mobileVideoUrl && (
              <div className="hidden md:block absolute inset-0">
                <video
                  src={mobileVideoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {!hasDesktopVideo && !desktopImageUrl && !hasMobileVideo && mobileImageUrl && (
              <div className="hidden md:block absolute inset-0">
                <Image
                  src={mobileImageUrl}
                  alt={title}
                  fill
                  priority
                  className="object-cover"
                  sizes="100vw"
                />
              </div>
            )}
            {/* Fallback: Use desktop video/image for mobile if mobile not available */}
            {!hasMobileVideo && !mobileImageUrl && hasDesktopVideo && desktopVideoUrl && (
              <div className="md:hidden absolute inset-0">
                <video
                  src={desktopVideoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {!hasMobileVideo && !mobileImageUrl && !hasDesktopVideo && desktopImageUrl && (
              <div className="md:hidden absolute inset-0">
                <Image
                  src={desktopImageUrl}
                  alt={title}
                  fill
                  priority
                  className="object-cover"
                  sizes="100vw"
                />
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-700" />
        )}

        {/* Overlay with content */}
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
        </div>
      </div>

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
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className={`mb-6 ${lng === "he" ? "text-right" : "text-left"}`}>
          {/* <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            {title}
          </h2> */}
          <p className="text-gray-600">
            {lng === "he" 
              ? `${products.length} מוצרים` 
              : `${products.length} products`}
          </p>
        </div>

        {products.length === 0 ? (
          <div className={`text-center py-12 ${lng === "he" ? "text-right" : "text-left"}`}>
            <p className="text-gray-500 text-lg">
              {lng === "he" 
                ? "לא נמצאו מוצרים במבצע זה" 
                : "No products found for this campaign"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id || product.sku}
                product={product}
                language={lng}
                returnUrl={`/${lng}/collection/campaign${campaign.slug ? `?slug=${campaign.slug}` : ""}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

