import type { CarouselOptions } from "@/app/components/ui/carousel";

/** Shared Embla options for product image galleries (grid cards + PDP). */
export const productImageCarouselOpts: CarouselOptions = {
  align: "start",
  containScroll: "trimSnaps",
  dragThreshold: 8,
  skipSnaps: false,
  loop: true,
}

export function getProductImageCarouselOpts(imageCount: number): CarouselOptions {
  return {
    ...productImageCarouselOpts,
    loop: imageCount > 2,
  }
}
