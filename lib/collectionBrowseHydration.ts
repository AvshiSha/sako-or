import type { Product, VariantItem } from "@/lib/firebase";
import { mergeCollectionPageResults } from "@/lib/collectionPageMerge";

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

    const merged = mergeCollectionPageResults(
      results.map((data, i) => ({
        products: data.items ?? [],
        variantItems: data.variantItems,
        total: data.total ?? 0,
        hasMore: data.hasMore ?? false,
        page: data.page ?? i + 1,
        pageSize: 24,
      }))
    );

    const combined = useVariantItems
      ? (merged.variantItems ?? [])
      : merged.products;

    return {
      useVariantItems,
      combined,
      resolvedPage: lastSuccessfulPage || merged.page,
      total: merged.total,
      hasMore: merged.hasMore,
      count: combined.length,
    };
  } catch (error) {
    if (signal?.aborted) return empty;
    console.error("[collection] fetchCollectionPagesUpTo failed:", error);
    return empty;
  }
}
