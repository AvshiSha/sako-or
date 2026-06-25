import type { FilteredProductsResult, Product, VariantItem } from "@/lib/firebase";
import { getCollectionProducts } from "@/lib/firebase";

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

export type MergedCollectionPages = {
  variantItems?: VariantItem[];
  products: Product[];
  total: number;
  hasMore: boolean;
  page: number;
  availableFilterOptions?: FilteredProductsResult["availableFilterOptions"];
};

/** Merge sequential collection page results (shared by SSR and client hydration). */
export function mergeCollectionPageResults(
  results: FilteredProductsResult[]
): MergedCollectionPages {
  if (results.length === 0) {
    return { products: [], total: 0, hasMore: false, page: 1 };
  }

  const last = results[results.length - 1];
  const useVariantItems = results.some(
    (r) => (r.variantItems?.length ?? 0) > 0
  );

  if (useVariantItems) {
    const allKeys = new Set<string>();
    const combined: VariantItem[] = [];
    let total = 0;
    let resolvedPage = 1;

    for (let i = 0; i < results.length; i++) {
      const data = results[i];
      const list = data.variantItems ?? [];
      if (list.length > 0) {
        resolvedPage = data.page ?? i + 1;
      }
      total = data.total ?? total;
      for (const item of list) {
        const key = item.variantKey?.trim();
        if (!key || allKeys.has(key)) continue;
        allKeys.add(key);
        combined.push(item);
      }
    }

    return {
      variantItems: combined,
      products: [],
      total: total || combined.length,
      hasMore: last.hasMore ?? false,
      page: resolvedPage,
      availableFilterOptions: last.availableFilterOptions,
    };
  }

  const allIds = new Set<string>();
  const combined: Product[] = [];
  let total = 0;
  let resolvedPage = 1;

  for (let i = 0; i < results.length; i++) {
    const data = results[i];
    const list = data.products ?? [];
    if (list.length > 0) {
      resolvedPage = data.page ?? i + 1;
    }
    total = data.total ?? total;
    for (const item of list) {
      const key = productListKey(item);
      if (!key || allIds.has(key)) continue;
      allIds.add(key);
      combined.push(item);
    }
  }

  return {
    products: combined,
    total: total || combined.length,
    hasMore: last.hasMore ?? false,
    page: resolvedPage,
    availableFilterOptions: last.availableFilterOptions,
  };
}

/** Server-side: fetch collection pages 1..targetPage and merge for deep-link SSR. */
export async function getCollectionProductsUpToPage(
  categoryPath: string | undefined,
  searchParams: { [key: string]: string | string[] | undefined },
  language: "en" | "he",
  targetPage: number
): Promise<MergedCollectionPages> {
  if (targetPage < 2) {
    const single = await getCollectionProducts(
      categoryPath,
      searchParams,
      language
    );
    return mergeCollectionPageResults([single]);
  }

  const results: FilteredProductsResult[] = [];
  for (let page = 1; page <= targetPage; page++) {
    const pageParams = { ...searchParams, page: String(page) };
    const data = await getCollectionProducts(
      categoryPath,
      pageParams,
      language
    );
    results.push(data);
    const hasRows =
      (data.variantItems?.length ?? 0) > 0 || (data.products?.length ?? 0) > 0;
    if (!hasRows) break;
  }

  return mergeCollectionPageResults(results);
}
