/** Inlined early in layout to prevent collection grid CLS before Tailwind paints. */
export const COLLECTION_GRID_CRITICAL_CSS = `
.collection-product-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 0.5rem;
  row-gap: 0.5rem;
  overflow-anchor: none;
}
.collection-product-grid > * {
  /* 60.25vw is 50vw x 235/195: the mobile card's image is 4:5, not square. */
  min-height: calc(60.25vw + 4.75rem);
}
.product-card-info-block {
  min-height: 4.75rem;
}
.product-card-price-block {
  min-height: 1.5rem;
}
@media (min-width: 1024px) {
  /* 438:2984 lays the desktop grid four across, divided by a 1px gutter rather
     than the 1.5rem it used to carry. Keep in step with
     COLLECTION_GRID_BREAKPOINTS in CollectionClient, which estimates row heights
     from the same column count. */
  .collection-product-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    column-gap: 1px;
    row-gap: 1px;
  }
  .collection-product-grid > * {
    min-height: calc((min(100vw, 80rem) - 3rem - 3px) / 4 + 6.25rem);
  }
  .product-card-info-block {
    min-height: 6.25rem;
  }
}
`;
