import type { Product, VariantItem } from "@/lib/firebase";

export type CollectionPageFetchParams = {
  lng: string;
  categoryPath?: string;
  searchQuery?: string;
  searchParams: URLSearchParams;
};

export type CollectionPageResponse = {
  variantItems?: VariantItem[];
  items?: Product[];
  total?: number;
  hasMore?: boolean;
  page?: number;
};

function productListKey(product: Product): string | null {
  const idStr =
    product.id != null && String(product.id).trim() !== ""
      ? String(product.id).trim()
      : null;
  const skuStr =
    typeof product.sku === "string" && product.sku.trim() !== ""
      ? product.sku.trim()
      : null;
  return idStr ?? skuStr;
}

export async function fetchCollectionPage(
  page: number,
  params: CollectionPageFetchParams,
  signal?: AbortSignal
): Promise<CollectionPageResponse> {
  try {
    const apiUrl = new URL("/api/products/collection", window.location.origin);
    apiUrl.searchParams.set("page", String(page));
    apiUrl.searchParams.set("language", params.lng);
    if (params.categoryPath) {
      apiUrl.searchParams.set("categoryPath", params.categoryPath);
    }
    if (params.searchQuery) {
      apiUrl.searchParams.set("search", params.searchQuery);
    }
    params.searchParams.forEach((value, key) => {
      if (key !== "page" && key !== "search") {
        apiUrl.searchParams.set(key, value);
      }
    });
    const r = await fetch(apiUrl.toString(), { signal });
    if (!r.ok) {
      console.warn(
        `[collection] fetch page ${page} failed with status ${r.status}`
      );
      return {};
    }
    return (await r.json()) as CollectionPageResponse;
  } catch (error) {
    if (signal?.aborted) return {};
    console.error(`[collection] fetch page ${page} failed:`, error);
    return {};
  }
}

export type HydratedCollectionPages = {
  useVariantItems: boolean;
  combined: VariantItem[] | Product[];
  resolvedPage: number;
  total: number;
  hasMore: boolean;
  count: number;
};

/** Fetch pages 1..targetPage sequentially and merge (deep-link ?page=N bootstrap / Back refetch). */
export async function fetchCollectionPagesUpTo(
  targetPage: number,
  params: CollectionPageFetchParams,
  useVariantItems: boolean,
  signal?: AbortSignal
): Promise<HydratedCollectionPages> {
  const empty: HydratedCollectionPages = {
    useVariantItems,
    combined: [],
    resolvedPage: 1,
    total: 0,
    hasMore: false,
    count: 0,
  };

  if (targetPage < 1) return empty;

  try {
    const results: CollectionPageResponse[] = [];
    let lastSuccessfulPage = 0;

    for (let page = 1; page <= targetPage; page++) {
      if (signal?.aborted) return empty;
      const data = await fetchCollectionPage(page, params, signal);
      results.push(data);
      const hasRows =
        (data.variantItems?.length ?? 0) > 0 || (data.items?.length ?? 0) > 0;
      if (hasRows) {
        lastSuccessfulPage = page;
      }
    }

    const resolvedPage = lastSuccessfulPage || 1;

    if (useVariantItems) {
      const allKeys = new Set<string>();
      const combined: VariantItem[] = [];
      let total = 0;
      let hasMore = false;
      for (let i = 0; i < results.length; i++) {
        const data = results[i];
        const list = data?.variantItems || [];
        total = data?.total ?? total;
        hasMore = i === results.length - 1 ? !!data?.hasMore : true;
        list.forEach((item: VariantItem) => {
          if (!allKeys.has(item.variantKey)) {
            allKeys.add(item.variantKey);
            combined.push(item);
          }
        });
      }
      return {
        useVariantItems: true,
        combined,
        resolvedPage,
        total: total || combined.length,
        hasMore: !!hasMore,
        count: combined.length,
      };
    }

    const allIds = new Set<string>();
    const combined: Product[] = [];
    let total = 0;
    let hasMore = false;
    for (let i = 0; i < results.length; i++) {
      const data = results[i];
      const list = data?.items || [];
      total = data?.total ?? total;
      hasMore = i === results.length - 1 ? !!data?.hasMore : true;
      list.forEach((item: Product) => {
        const key = productListKey(item);
        if (key && !allIds.has(key)) {
          allIds.add(key);
          combined.push(item);
        }
      });
    }
    return {
      useVariantItems: false,
      combined,
      resolvedPage,
      total: total || combined.length,
      hasMore: !!hasMore,
      count: combined.length,
    };
  } catch (error) {
    if (signal?.aborted) return empty;
    console.error("[collection] fetchCollectionPagesUpTo failed:", error);
    return empty;
  }
}
