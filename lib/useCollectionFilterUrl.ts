"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  buildCollectionFilterKey,
  priceRangeToUrlParams,
  readFilterUiStateFromSearchParams,
} from "@/lib/collectionFilterUrl";
import {
  resetCollectionScrollForFilterChange,
  scrollCollectionToTop,
} from "@/lib/collectionScrollRestore";

export type CollectionFilterPatch = {
  colors?: string[];
  sizes?: string[];
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  subSubCategories?: string[];
};

type UseCollectionFilterUrlOptions = {
  lng: string;
  slug?: string[];
  categoryPath?: string;
  searchQuery?: string;
  searchParams: URLSearchParams;
  priceBounds?: { min: number; max: number };
  uiRange: [number, number];
};

/** Push filter changes to the collection URL (single source of truth). */
export function useCollectionFilterUrl({
  lng,
  slug,
  categoryPath,
  searchQuery,
  searchParams,
}: UseCollectionFilterUrlOptions) {
  const router = useRouter();

  const pushFilters = useCallback(
    (patch: CollectionFilterPatch, resetPage = true) => {
      const urlParams = new URLSearchParams(searchParams.toString());
      if (resetPage) {
        urlParams.delete("page");
      }
      urlParams.delete("colors");
      urlParams.delete("sizes");
      urlParams.delete("minPrice");
      urlParams.delete("maxPrice");
      urlParams.delete("sort");
      urlParams.delete("subSubCategories");

      if (patch.colors?.length) {
        urlParams.set("colors", patch.colors.join(","));
      }
      if (patch.sizes?.length) {
        urlParams.set("sizes", patch.sizes.join(","));
      }
      if (patch.subSubCategories?.length) {
        urlParams.set("subSubCategories", patch.subSubCategories.join(","));
      }
      if (patch.minPrice?.trim()) {
        urlParams.set("minPrice", patch.minPrice);
      }
      if (patch.maxPrice?.trim()) {
        urlParams.set("maxPrice", patch.maxPrice);
      }
      if (patch.sort && patch.sort !== "relevance") {
        urlParams.set("sort", patch.sort);
      }

      const queryString = urlParams.toString();
      const currentPath = `/${lng}/collection${slug?.length ? "/" + slug.join("/") : ""}`;
      const newUrl = queryString ? `${currentPath}?${queryString}` : currentPath;

      resetCollectionScrollForFilterChange();
      scrollCollectionToTop();
      router.push(newUrl, { scroll: false });
      requestAnimationFrame(() => scrollCollectionToTop());
    },
    [lng, slug, searchParams, router]
  );

  const readUi = useCallback(
    () =>
      readFilterUiStateFromSearchParams(
        searchParams,
        undefined
      ),
    [searchParams]
  );

  const filterKey = buildCollectionFilterKey(searchParams, {
    categoryPath,
    searchQuery,
  });

  return { pushFilters, readUi, filterKey, priceRangeToUrlParams };
}
