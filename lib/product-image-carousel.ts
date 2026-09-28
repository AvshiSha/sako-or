import type { CarouselOptions } from "@/app/components/ui/carousel";

/** Max height for sticky PDP gallery below the site header (desktop). */
export const PDP_GALLERY_MAX_HEIGHT = "calc(100dvh - 7rem)";

/**
 * UNRESOLVED - the PDP gallery stays square.
 *
 * Product / Mobile (438:4188) frames it 390x610, i.e. 39:61, and its slides are
 * 390x693 - the frame is drawn against tall, portrait product photography. The
 * catalogue's images are square with the shoe centred and filling most of the
 * width, so object-cover into a 39:61 box scales to the taller side and crops
 * roughly 210px off the sides at phone width, taking the toe and heel with it.
 * object-contain instead letterboxes, which is the empty band this replaced.
 *
 * Square is therefore the honest ratio for the assets that exist. Revisit if the
 * shoot supplies portrait PDP imagery, at which point this is a one-line change.
 */

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
