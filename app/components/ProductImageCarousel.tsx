"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/app/components/ui/carousel";
import { ProductGalleryImage } from "@/app/components/ProductGalleryImage";
import {
  getProductCardCarouselOpts,
  getProductImageCarouselOpts,
} from "@/lib/product-image-carousel";
import { cn } from "@/lib/utils";

/** Updates only after swipe settles — avoids parent/slide re-renders mid-drag. */
function useEmblaSettledIndex(api: CarouselApi | undefined) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!api) return;

    const sync = () => setIndex(api.selectedScrollSnap());

    sync();
    api.on("settle", sync);
    api.on("reInit", sync);

    return () => {
      api.off("settle", sync);
      api.off("reInit", sync);
    };
  }, [api]);

  return index;
}

const CarouselDotIndicators = memo(function CarouselDotIndicators({
  count,
  activeIndex,
  position = "top",
  size = "sm",
  interactive = false,
  onSelect,
  selectLabelPrefix = "Go to image",
}: {
  count: number;
  activeIndex: number;
  position?: "top" | "bottom";
  size?: "sm" | "md";
  interactive?: boolean;
  onSelect?: (index: number) => void;
  selectLabelPrefix?: string;
}) {
  if (count <= 1) return null;

  const isMd = size === "md";

  return (
    <div
      className={cn(
        "absolute left-1/2 z-10 flex -translate-x-1/2 gap-1.5",
        position === "top" ? "top-2" : "bottom-4",
        interactive ? "space-x-2" : "pointer-events-none"
      )}
      aria-hidden={!interactive}
    >
      {Array.from({ length: count }).map((_, index) => {
        const active = activeIndex === index;
        const className = cn(
          "rounded-full bg-[#E1DBD7]",
          isMd ? "h-2" : "h-1 w-1",
          active
            ? isMd
              ? "w-6 opacity-100"
              : "w-1 opacity-100"
            : isMd
              ? "w-2 opacity-50 hover:bg-[#E1DBD7]/75"
              : "w-1 opacity-50"
        );

        if (interactive) {
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelect?.(index)}
              className={className}
              aria-label={`${selectLabelPrefix} ${index + 1}`}
            />
          );
        }

        return <div key={index} className={className} />;
      })}
    </div>
  );
});

export type ProductImageCarouselProps = {
  images: string[];
  alt: string;
  direction?: "ltr" | "rtl";
  variant?: "card" | "pdp";
  className?: string;
  /** First slide in viewport (collection above-the-fold). */
  isAboveFold?: boolean;
  /** Snap to this slide once after init (e.g. primary image on color swatch). */
  initialIndex?: number;
  setApi?: (api: CarouselApi) => void;
  children?: ReactNode;
  /** PDP: tappable pagination dots */
  dotSelectLabelPrefix?: string;
};

function ProductImageCarouselInner({
  images,
  alt,
  direction = "ltr",
  variant = "card",
  className,
  isAboveFold = variant === "pdp",
  initialIndex = 0,
  setApi,
  children,
  dotSelectLabelPrefix = "Go to image",
}: ProductImageCarouselProps) {
  const [api, setLocalApi] = useState<CarouselApi>();
  const settledIndex = useEmblaSettledIndex(api);
  const isPdp = variant === "pdp";

  useEffect(() => {
    if (!api || initialIndex <= 0) return;
    api.scrollTo(initialIndex, false);
  }, [api, initialIndex]);

  const handleSetApi = useCallback(
    (instance: CarouselApi) => {
      setLocalApi(instance);
      setApi?.(instance);
    },
    [setApi]
  );

  const opts = useMemo(
    () =>
      variant === "pdp"
        ? getProductImageCarouselOpts(images.length)
        : getProductCardCarouselOpts(images.length),
    [variant, images.length]
  );

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-gray-100" style={{ aspectRatio: '1 / 1' }}>
        <span className="text-sm text-gray-400">No image</span>
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <div
        className={cn("relative aspect-square w-full overflow-hidden", className)}
        style={{ aspectRatio: "1 / 1" }}
      >
        <ProductGalleryImage src={images[0]} alt={alt} eager={isAboveFold} />
        {children}
      </div>
    );
  }

  return (
    <Carousel
      setApi={handleSetApi}
      direction={direction}
      itemVariant="flush"
      performanceMode="grid"
      opts={opts}
      className={cn(isPdp ? "w-full h-auto" : "h-full w-full", className)}
    >
      <div
        className={cn(
          "group relative aspect-square w-full overflow-hidden",
          isPdp ? "max-h-[inherit]" : "h-full"
        )}
        style={{ aspectRatio: '1 / 1' }}
      >
        <CarouselContent className="h-full">
          {images.map((src, index) => (
            <CarouselItem key={`${src}-${index}`} className="h-full basis-full">
              <ProductGalleryImage
                src={src}
                alt={`${alt} - ${index + 1}`}
                eager={
                  isPdp
                    ? index === 0
                    : index < 2 || (isAboveFold && index === 0)
                }
              />
            </CarouselItem>
          ))}
        </CarouselContent>

        {variant === "card" && (
          <CarouselDotIndicators
            count={images.length}
            activeIndex={settledIndex}
            position="top"
            size="sm"
          />
        )}

        {variant === "pdp" && (
          <>
            {direction === "rtl" ? (
              <>
                <CarouselPrevious className="!right-2 sm:!right-4 !left-auto !-translate-y-1/2 !opacity-50 z-20 pointer-events-auto h-6 w-6 [&>svg]:text-[#000000] [&>svg]:rotate-180 disabled:!opacity-30 [&[disabled]]:!pointer-events-auto" />
                <CarouselNext className="!left-2 sm:!left-4 !right-auto !-translate-y-1/2 !opacity-50 z-20 pointer-events-auto h-6 w-6 [&>svg]:text-[#000000] [&>svg]:rotate-180 disabled:!opacity-30 [&[disabled]]:!pointer-events-auto" />
              </>
            ) : (
              <>
                <CarouselPrevious className="!left-2 sm:!left-4 !-translate-y-1/2 opacity-50 sm:opacity-100 group-hover:opacity-100 transition-opacity pointer-events-auto h-6 w-6 [&>svg]:text-[#000000] z-20" />
                <CarouselNext className="!right-2 sm:!right-4 !-translate-y-1/2 opacity-50 sm:opacity-100 group-hover:opacity-100 transition-opacity pointer-events-auto h-6 w-6 [&>svg]:text-[#000000] z-20" />
              </>
            )}
            <CarouselDotIndicators
              count={images.length}
              activeIndex={settledIndex}
              position="bottom"
              size="md"
              interactive
              onSelect={(index) => api?.scrollTo(index)}
              selectLabelPrefix={dotSelectLabelPrefix}
            />
          </>
        )}

        {children}
      </div>
    </Carousel>
  );
}

export const ProductImageCarousel = memo(ProductImageCarouselInner);
