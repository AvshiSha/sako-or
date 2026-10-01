/** Inlined early in layout to prevent collection grid CLS before Tailwind paints. */
export const COLLECTION_GRID_CRITICAL_CSS = `
/* No gutter at any width. The cards draw their own divisions - border-l on the
   card root, border-t on the info block - so a grid gap only lets the page's
   white ground through between rows as a hairline. */
.collection-product-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 0;
  row-gap: 0;
  overflow-anchor: none;
}
/*
 * These reservations must UNDER-estimate, never over-estimate.
 *
 * min-height taller than the card leaves the difference as blank ground under
 * it - the same white line a grid gap produces - and it would scale with the
 * viewport, so it would look "fixed" at one width and wrong at another. Coming
 * in short only costs a little CLS before the image lands.
 *
 * Hence the 20px: 100vw counts the classic scrollbar, the grid does not get it,
 * and without the allowance every card would reserve roughly a scrollbar's worth
 * of height more than it uses.
 *
 * 0.6025 is 235/195 halved - the mobile card's image is 4:5, not square.
 */
.collection-product-grid > * {
  min-height: calc((100vw - 20px) * 0.6025 + 7.375rem);
}
.product-card-info-block {
  min-height: 7.375rem;
}
.product-card-price-block {
  min-height: 1.5rem;
}
@media (min-width: 1024px) {
  /* 438:2984 lays the desktop grid four across, full-bleed. Keep in step with
     COLLECTION_GRID_BREAKPOINTS in CollectionClient, which estimates row heights
     from the same column count. The old sum still subtracted a 3rem container
     inset and three 1px gutters; neither exists now. */
  .collection-product-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    column-gap: 0;
    row-gap: 0;
  }
  .collection-product-grid > * {
    min-height: calc((100vw - 20px) / 4 + 8.5rem);
  }
  .product-card-info-block {
    min-height: 8.5rem;
  }
}
`;
