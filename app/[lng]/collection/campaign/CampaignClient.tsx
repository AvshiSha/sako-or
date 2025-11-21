"use client";

import { useState } from "react";
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

  // Determine banner image based on screen size (will be handled by CSS)
  const bannerUrl = campaign.bannerDesktopUrl || campaign.bannerMobileUrl;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative w-full h-[60vh] md:h-[70vh] overflow-hidden">
        {bannerUrl ? (
          <>
            {/* Desktop Banner */}
            {campaign.bannerDesktopUrl && (
              <div className="hidden md:block absolute inset-0">
                <Image
                  src={campaign.bannerDesktopUrl}
                  alt=""
                  fill
                  priority
                  className="object-cover"
                  sizes="100vw"
                />
              </div>
            )}
            {/* Mobile Banner */}
            {campaign.bannerMobileUrl && (
              <div className="md:hidden absolute inset-0">
                <Image
                  src={campaign.bannerMobileUrl}
                  alt=""
                  fill
                  priority
                  className="object-cover"
                  sizes="100vw"
                />
              </div>
            )}
            {/* Fallback if only one banner exists */}
            {!campaign.bannerDesktopUrl && campaign.bannerMobileUrl && (
              <div className="hidden md:block absolute inset-0">
                <Image
                  src={campaign.bannerMobileUrl}
                  alt={title}
                  fill
                  priority
                  className="object-cover"
                  sizes="100vw"
                />
              </div>
            )}
            {!campaign.bannerMobileUrl && campaign.bannerDesktopUrl && (
              <div className="md:hidden absolute inset-0">
                <Image
                  src={campaign.bannerDesktopUrl}
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
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            {title}
          </h2>
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

