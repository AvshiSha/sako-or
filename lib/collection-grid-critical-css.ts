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
  .collection-product-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    column-gap: 1.5rem;
    row-gap: 1.5rem;
  }
  .collection-product-grid > * {
    min-height: calc((min(100vw, 80rem) - 3rem) / 3 + 6.25rem);
  }
  .product-card-info-block {
    min-height: 6.25rem;
  }
}
`;
