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
  min-height: calc(50vw + 8.75rem);
}
.product-card-info-block {
  min-height: 5.5rem;
}
.product-card-price-block {
  min-height: 2.5rem;
}
.product-card-swatch-block {
  min-height: 3.25rem;
}
@media (min-width: 1024px) {
  .collection-product-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    column-gap: 1.5rem;
    row-gap: 1.5rem;
  }
  .collection-product-grid > * {
    min-height: calc((min(100vw, 80rem) - 3rem) / 3 + 8.75rem);
  }
}
`;
