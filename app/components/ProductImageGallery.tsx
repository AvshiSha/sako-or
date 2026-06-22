"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { ArrowsPointingOutIcon } from "@heroicons/react/24/outline";
import { ProductGalleryImage } from "@/app/components/ProductGalleryImage";
import { ProductImageCarousel } from "@/app/components/ProductImageCarousel";
import { ProductImageLightbox } from "@/app/components/ProductImageLightbox";
import { useLgDesktop } from "@/lib/use-lg-desktop";
import { cn } from "@/lib/utils";

export type ProductImageGalleryProps = {
  images: string[];
  alt: string;
  direction?: "ltr" | "rtl";
  className?: string;
  isAboveFold?: boolean;
  dotSelectLabelPrefix?: string;
  children?: ReactNode;
  fullscreenLabelPrefix?: string;
};

function useGalleryActiveIndex(
  containerRef: RefObject<HTMLDivElement | null>,
  sectionCount: number
) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || sectionCount === 0) return;

    const ratios = new Map<number, number>();
    const sections = container.querySelectorAll<HTMLElement>(
      "[data-gallery-index]"
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number(entry.target.getAttribute("data-gallery-index"));
          ratios.set(index, entry.intersectionRatio);
        });

        let bestIndex = 0;
        let bestRatio = -1;
        ratios.forEach((ratio, i) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestIndex = i;
          }
        });

        if (bestRatio > 0) {
          setActiveIndex(bestIndex);
        }
      },
      {
        root: null,
        threshold: [0, 0.25, 0.5, 0.75, 1],
        rootMargin: "-20% 0px -20% 0px",
      }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [containerRef, sectionCount]);

  return activeIndex;
}

const ProductImageVerticalGallery = memo(function ProductImageVerticalGallery({
  images,
  alt,
  direction = "ltr",
  className,
  isAboveFold = true,
  fullscreenLabelPrefix = "View image",
  children,
}: Omit<ProductImageGalleryProps, "dotSelectLabelPrefix">) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const activeIndex = useGalleryActiveIndex(containerRef, images.length);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  if (images.length === 0) {
    return (
      <div
        className="flex aspect-square w-full items-center justify-center bg-gray-100"
        style={{ aspectRatio: "1 / 1" }}
      >
        <span className="text-sm text-gray-400">No image</span>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className={cn("flex flex-col gap-y-0", className)}>
        {images.map((src, index) => {
          const isActive = activeIndex === index;
          const eager = isAboveFold && index === 0;

          return (
            <section
              key={`${src}-${index}`}
              data-gallery-index={index}
              aria-current={isActive ? "true" : undefined}
              className="flex snap-start items-center justify-center bg-[#f5f5f5] py-0"
            >
              <button
                type="button"
                onClick={() => openLightbox(index)}
                className="group relative mx-auto w-full max-w-[min(100%,720px)] cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-4"
                aria-label={`${fullscreenLabelPrefix} ${index + 1} of ${images.length}`}
              >
                <ProductGalleryImage
                  src={src}
                  alt={`${alt} - ${index + 1}`}
                  eager={eager}
                  objectFit="contain"
                  className="bg-transparent"
                />
                <span
                  className="pointer-events-none absolute bottom-5 left-5 text-gray-900/70 transition-opacity group-hover:text-gray-900"
                  aria-hidden
                >
                  <ArrowsPointingOutIcon className="h-5 w-5 stroke-[1.25]" />
                </span>
              </button>
            </section>
          );
        })}
        {children}
      </div>

      <ProductImageLightbox
        images={images}
        alt={alt}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        direction={direction}
        labels={{
          imageOf: (current, total) => `${alt} - ${current} of ${total}`,
        }}
      />
    </>
  );
});

function ProductImageGalleryInner({
  images,
  alt,
  direction = "ltr",
  className,
  isAboveFold = true,
  dotSelectLabelPrefix = "Go to image",
  fullscreenLabelPrefix = "View image",
  children,
}: ProductImageGalleryProps) {
  const isLgDesktop = useLgDesktop();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <ProductImageCarousel
        images={images}
        alt={alt}
        direction={direction}
        variant="pdp"
        isAboveFold={isAboveFold}
        className={className}
        dotSelectLabelPrefix={dotSelectLabelPrefix}
      >
        {children}
      </ProductImageCarousel>
    );
  }

  if (isLgDesktop) {
    return (
      <ProductImageVerticalGallery
        images={images}
        alt={alt}
        direction={direction}
        className={className}
        isAboveFold={isAboveFold}
        fullscreenLabelPrefix={fullscreenLabelPrefix}
      >
        {children}
      </ProductImageVerticalGallery>
    );
  }

  return (
    <ProductImageCarousel
      images={images}
      alt={alt}
      direction={direction}
      variant="pdp"
      isAboveFold={isAboveFold}
      className={className}
      dotSelectLabelPrefix={dotSelectLabelPrefix}
    >
      {children}
    </ProductImageCarousel>
  );
}

export const ProductImageGallery = memo(ProductImageGalleryInner);
