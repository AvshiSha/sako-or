import type { CarouselOptions } from "@/app/components/ui/carousel";

/** Shared Embla options for product image galleries (grid cards + PDP). */
export const productImageCarouselOpts: CarouselOptions = {
  align: "start",
  containScroll: "trimSnaps",
  dragThreshold: 5,
  skipSnaps: true,
  loop: false,
};

/** Mobile-first tuning: slightly looser snap on small screens for flick gestures. */
export const productImageCarouselMobileBreakpoints = {
  "(min-width: 768px)": {
    skipSnaps: false,
    dragThreshold: 8,
  },
} as const satisfies NonNullable<CarouselOptions>["breakpoints"];

export function getProductImageCarouselOpts(imageCount: number): CarouselOptions {
  return {
    ...productImageCarouselOpts,
    loop: imageCount > 2,
    breakpoints: productImageCarouselMobileBreakpoints,
  };
}

/** Grid product cards: infinite loop when there are multiple images. */
export function getProductCardCarouselOpts(imageCount: number): CarouselOptions {
  return {
    ...productImageCarouselOpts,
    loop: imageCount > 1,
    breakpoints: productImageCarouselMobileBreakpoints,
  };
}
