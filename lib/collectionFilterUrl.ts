const PRICE_BOUNDS_TOLERANCE = 0.5;

/** Only persist price query params when the slider is narrowed from full collection bounds. */
export function priceRangeToUrlParams(
  range: [number, number],
  bounds: { min: number; max: number } | undefined
): { minPrice: string; maxPrice: string } {
  if (!bounds) {
    return { minPrice: "", maxPrice: "" };
  }
  const [min, max] = range;
  const atFullBounds =
    Math.abs(min - bounds.min) <= PRICE_BOUNDS_TOLERANCE &&
    Math.abs(max - bounds.max) <= PRICE_BOUNDS_TOLERANCE;
  if (atFullBounds) {
    return { minPrice: "", maxPrice: "" };
  }
  return {
    minPrice: String(Math.round(min)),
    maxPrice: String(Math.round(max)),
  };
}

export function parseCommaList(param: string | null): string[] {
  return param ? param.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

/** Stable key for collection filter URL state (excludes page and search query param). */
export function buildCollectionFilterKey(
  params: URLSearchParams,
  options?: { categoryPath?: string; searchQuery?: string }
): string {
  const keyParts: string[] = [];
  if (options?.categoryPath) {
    keyParts.push(`cat:${options.categoryPath}`);
  }
  if (options?.searchQuery) {
    keyParts.push(`search:${options.searchQuery}`);
  }
  params.forEach((value, key) => {
    if (key !== "page" && key !== "search") {
      keyParts.push(`${key}:${value}`);
    }
  });
  return keyParts.sort().join("|");
}

const VALID_SORT_VALUES = new Set([
  "relevance",
  "newest",
  "price-low",
  "price-high",
  "priceAsc",
  "priceDesc",
]);

export type CollectionFilterUiFromUrl = {
  colors: string[];
  sizes: string[];
  subSubCategories: string[];
  sort: string;
  uiRange: [number, number];
};

/** Read filter chip + price slider state from URL (source of truth for external navigation). */
export function readFilterUiStateFromSearchParams(
  params: URLSearchParams,
  bounds: { min: number; max: number } | undefined
): CollectionFilterUiFromUrl {
  const boundsMin = bounds?.min ?? 0;
  const boundsMax = bounds?.max ?? 1000;
  const urlMinStr = params.get("minPrice") || "";
  const urlMaxStr = params.get("maxPrice") || "";
  const urlMin = urlMinStr ? parseFloat(urlMinStr) : boundsMin;
  const urlMax = urlMaxStr ? parseFloat(urlMaxStr) : boundsMax;
  const validMin = Number.isNaN(urlMin) ? boundsMin : urlMin;
  const validMax = Number.isNaN(urlMax) ? boundsMax : urlMax;

  const sortParam = params.get("sort") || "relevance";
  const sort = VALID_SORT_VALUES.has(sortParam) ? sortParam : "relevance";

  return {
    colors: parseCommaList(params.get("colors")),
    sizes: parseCommaList(params.get("sizes")),
    subSubCategories: parseCommaList(params.get("subSubCategories")),
    sort,
    uiRange: [Math.min(validMin, validMax), Math.max(validMin, validMax)],
  };
}

export function sameSortedStringList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}
