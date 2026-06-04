"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Product, VariantItem } from "@/lib/firebase";
import {
  clearCollectionState,
  getCollectionState,
  setCollectionState,
} from "@/lib/collectionBrowseStore";
import {
  resetCollectionScrollForFilterChange,
  scrollCollectionToTop,
} from "@/lib/collectionScrollRestore";

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

export function dedupeVariantItems(
  existing: VariantItem[],
  incoming: VariantItem[]
): VariantItem[] {
  const seen = new Set<string>();
  for (const item of existing) {
    const key = item.variantKey?.trim();
    if (key) seen.add(key);
  }
  const unique: VariantItem[] = [];
  for (const item of incoming) {
    const key = item.variantKey?.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

export function dedupeProducts(existing: Product[], incoming: Product[]): Product[] {
  const seen = new Set<string>();
  for (const item of existing) {
    const key = productListKey(item);
    if (key) seen.add(key);
  }
  const unique: Product[] = [];
  for (const item of incoming) {
    const key = productListKey(item);
    if (key === null || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

export type UseCollectionProductListParams = {
  filterKey: string;
  collectionKey: string;
  useVariantItems: boolean;
  initialVariantItems?: VariantItem[];
  initialProducts: Product[];
  searchTotal?: number;
  searchPage?: number;
  initialHasMore: boolean;
  /** When true, skip server sync (PDP back hydration in progress). */
  skipServerSync?: boolean;
};

export function useCollectionProductList({
  filterKey,
  collectionKey,
  useVariantItems,
  initialVariantItems,
  initialProducts,
  searchTotal,
  searchPage = 1,
  initialHasMore,
  skipServerSync = false,
}: UseCollectionProductListParams) {
  const [allVariantItems, setAllVariantItems] = useState<VariantItem[]>(
    initialVariantItems ?? []
  );
  const [allProducts, setAllProducts] = useState<Product[]>(initialProducts);
  const [currentPage, setCurrentPage] = useState(searchPage);
  const [totalProducts, setTotalProducts] = useState(
    searchTotal ??
      (useVariantItems ? (initialVariantItems?.length ?? 0) : initialProducts.length)
  );
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const prevFilterKeyRef = useRef(filterKey);
  const prevCollectionKeyRef = useRef(collectionKey);
  const hydratedFromStoreRef = useRef(false);
  const loadMoreEpochRef = useRef(0);
  const loadMoreAbortRef = useRef<AbortController | null>(null);

  const applyServerList = useCallback(() => {
    if (useVariantItems && initialVariantItems) {
      setAllVariantItems(initialVariantItems);
      setTotalProducts(searchTotal ?? initialVariantItems.length);
    } else {
      setAllProducts(initialProducts);
      setTotalProducts(searchTotal ?? initialProducts.length);
    }
    setCurrentPage(searchPage || 1);
    setHasMore(initialHasMore);

    const stored = getCollectionState(collectionKey);
    if (stored) {
      setCollectionState(collectionKey, {
        ...stored,
        items: useVariantItems ? (initialVariantItems ?? []) : initialProducts,
        useVariantItems,
        currentPage: searchPage || 1,
        totalProducts: searchTotal ?? stored.totalProducts,
        hasMore: initialHasMore,
        scrollY: 0,
        anchorVariantKey: undefined,
        updatedAt: Date.now(),
      });
    }
  }, [
    useVariantItems,
    initialVariantItems,
    initialProducts,
    searchTotal,
    searchPage,
    initialHasMore,
    collectionKey,
  ]);

  useEffect(() => {
    if (skipServerSync) return;

    const filterChanged = prevFilterKeyRef.current !== filterKey;

    if (filterChanged) {
      if (
        prevCollectionKeyRef.current &&
        prevCollectionKeyRef.current !== collectionKey
      ) {
        clearCollectionState(prevCollectionKeyRef.current);
      }
      prevFilterKeyRef.current = filterKey;
      prevCollectionKeyRef.current = collectionKey;
      hydratedFromStoreRef.current = false;

      loadMoreAbortRef.current?.abort();
      loadMoreAbortRef.current = null;
      loadMoreEpochRef.current += 1;
      setIsLoadingMore(false);

      resetCollectionScrollForFilterChange();
      scrollCollectionToTop();
      applyServerList();
      return;
    }

    if (hydratedFromStoreRef.current) return;

    const initialCount = useVariantItems
      ? (initialVariantItems?.length ?? 0)
      : initialProducts.length;
    const accumulatedCount = useVariantItems
      ? allVariantItems.length
      : allProducts.length;
    if (accumulatedCount > initialCount) return;

    applyServerList();
  }, [
    filterKey,
    collectionKey,
    skipServerSync,
    applyServerList,
    useVariantItems,
    initialVariantItems,
    initialProducts,
  ]);

  return {
    allVariantItems,
    setAllVariantItems,
    allProducts,
    setAllProducts,
    currentPage,
    setCurrentPage,
    totalProducts,
    setTotalProducts,
    hasMore,
    setHasMore,
    isLoadingMore,
    setIsLoadingMore,
    hydratedFromStoreRef,
    loadMoreEpochRef,
    loadMoreAbortRef,
    applyServerList,
  };
}
