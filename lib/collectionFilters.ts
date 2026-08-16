import type { Product, ProductFilters, ProductSortOption } from "@/lib/firebase";
import { variantHasSizeInStock } from "@/lib/product-size";
import { deriveFitsA4 } from "@/lib/bag-derived";

/**
 * Bag facet matching.
 *
 * Unknown never matches. A bag whose `bagType` nobody has filled in is excluded
 * from a bagType filter rather than shown on the chance it might qualify —
 * the filters exist so a customer can trust the result, and a maybe-match is
 * worse than a shorter list. The same rule makes an unmeasured bag fail
 * `fitsA4`.
 */
function matchesBagFilters(product: Product, filters: ProductFilters): boolean {
  const bagSpecs = product.bagSpecs;

  const matchesSingle = (selected: string[] | undefined, value: string | undefined): boolean => {
    if (!selected || selected.length === 0) return true;
    return !!value && selected.includes(value);
  };

  const matchesAny = (selected: string[] | undefined, values: string[] | undefined): boolean => {
    if (!selected || selected.length === 0) return true;
    if (!values || values.length === 0) return false;
    return values.some((value) => selected.includes(value));
  };

  if (!matchesSingle(filters.bagType, bagSpecs?.bagType)) return false;
  if (!matchesSingle(filters.strapType, bagSpecs?.strapType)) return false;
  if (!matchesAny(filters.intendedUse, bagSpecs?.intendedUse)) return false;
  if (!matchesAny(filters.carryingOptions, bagSpecs?.carryingOptions)) return false;
  if (!matchesSingle(filters.closureType, product.materialCare?.closureType)) return false;

  if (filters.bagSizeCategory && filters.bagSizeCategory.length > 0) {
    // Size category may be stored (an override) or implied by the dimensions;
    // the stored Postgres column already reconciles the two, but this in-memory
    // path reads Firestore, so fall back to the override only.
    if (!matchesSingle(filters.bagSizeCategory, bagSpecs?.bagSizeCategory)) return false;
  }

  if (filters.fitsA4) {
    const fitsA4 =
      bagSpecs?.fitsA4 ??
      deriveFitsA4(
        product.materialCare?.heightCm,
        product.materialCare?.widthCm,
        bagSpecs?.bagStructure ?? null
      );
    if (fitsA4 !== true) return false;
  }

  return true;
}

/** Whether a product matches listing filters (category, facets, price; not variant expansion). */
export function productMatchesListingFilters(
  product: Product,
  filters: ProductFilters
): boolean {
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    const categoryIds = filters.categoryIds;
    if (!product.categories_path_id || product.categories_path_id.length === 0) {
      return false;
    }
    if (product.categories_path_id.length < categoryIds.length) {
      return false;
    }
    for (let i = 0; i < categoryIds.length; i++) {
      if (product.categories_path_id[i] !== categoryIds[i]) {
        return false;
      }
    }
  } else if (filters.categoryId && filters.categoryLevel !== undefined) {
    const targetLevel = filters.categoryLevel;
    if (!product.categories_path_id || product.categories_path_id.length === 0) {
      return false;
    }
    if (product.categories_path_id.length > targetLevel) {
      return product.categories_path_id[targetLevel] === filters.categoryId;
    }
    return false;
  } else if (filters.categoryPath) {
    const categoryPathLower = filters.categoryPath.toLowerCase();
    const requestedPath = categoryPathLower;
    if (!product.categories_path || product.categories_path.length === 0) {
      return false;
    }
    const productPath = product.categories_path.join("/").toLowerCase();
    if (productPath === requestedPath) {
      return true;
    }
    if (productPath.startsWith(requestedPath + "/")) {
      return true;
    }
    if (requestedPath.startsWith(productPath + "/")) {
      return true;
    }
    return false;
  }

  if (filters.subSubCategoryIds && filters.subSubCategoryIds.length > 0) {
    const subSubCategoryIds = filters.subSubCategoryIds;
    if (!product.categories_path_id || product.categories_path_id.length < 3) {
      return false;
    }
    const productSubSubCategoryId = product.categories_path_id[2];
    if (!subSubCategoryIds.includes(productSubSubCategoryId)) {
      return false;
    }
  }

  if (filters.excludeSkus && filters.excludeSkus.length > 0) {
    if (filters.excludeSkus.includes(product.sku)) {
      return false;
    }
  }

  if (filters.color && (Array.isArray(filters.color) ? filters.color.length > 0 : true)) {
    const colors = Array.isArray(filters.color) ? filters.color : [filters.color];
    if (!product.colorVariants) {
      return false;
    }
    const hasColor = Object.values(product.colorVariants)
      .filter((variant) => variant.isActive !== false)
      .some((variant) => colors.includes(variant.colorSlug || ""));
    if (!hasColor) {
      return false;
    }
  }

  if (filters.size && (Array.isArray(filters.size) ? filters.size.length > 0 : true)) {
    const sizes = Array.isArray(filters.size) ? filters.size : [filters.size];
    if (!product.colorVariants) {
      return false;
    }
    const hasSize = Object.values(product.colorVariants)
      .filter((variant) => variant.isActive !== false)
      .some((variant) => variantHasSizeInStock(variant, sizes));
    if (!hasSize) {
      return false;
    }
  }

  if (filters.inStockOnly) {
    if (!product.colorVariants) {
      return false;
    }
    const inStock = Object.values(product.colorVariants)
      .filter((variant) => variant.isActive !== false)
      .some((variant) =>
        Object.values(variant.stockBySize || {}).some((stock) => stock > 0)
      );
    if (!inStock) {
      return false;
    }
  }

  if (!matchesBagFilters(product, filters)) {
    return false;
  }

  if (filters.minPrice !== undefined && filters.minPrice > 0) {
    if (!product.colorVariants || Object.keys(product.colorVariants).length === 0) {
      const productPrice =
        product.salePrice && product.salePrice > 0 ? product.salePrice : product.price;
      if (productPrice < filters.minPrice) {
        return false;
      }
    } else {
      const variantPrices = Object.values(product.colorVariants)
        .filter((variant) => variant.isActive !== false)
        .map((variant) => {
          if (variant.salePrice && variant.salePrice > 0) return variant.salePrice;
          if (product.salePrice && product.salePrice > 0) return product.salePrice;
          if ((variant as { priceOverride?: number }).priceOverride &&
            (variant as { priceOverride?: number }).priceOverride! > 0) {
            return (variant as { priceOverride?: number }).priceOverride!;
          }
          return product.price;
        });
      if (variantPrices.length === 0) {
        const productPrice =
          product.salePrice && product.salePrice > 0 ? product.salePrice : product.price;
        if (productPrice < filters.minPrice) {
          return false;
        }
      } else if (Math.min(...variantPrices) < filters.minPrice) {
        return false;
      }
    }
  }

  if (filters.maxPrice !== undefined && filters.maxPrice > 0) {
    if (!product.colorVariants || Object.keys(product.colorVariants).length === 0) {
      const productPrice =
        product.salePrice && product.salePrice > 0 ? product.salePrice : product.price;
      if (productPrice > filters.maxPrice) {
        return false;
      }
    } else {
      const variantPrices = Object.values(product.colorVariants)
        .filter((variant) => variant.isActive !== false)
        .map((variant) => {
          if (variant.salePrice && variant.salePrice > 0) return variant.salePrice;
          if (product.salePrice && product.salePrice > 0) return product.salePrice;
          if ((variant as { priceOverride?: number }).priceOverride &&
            (variant as { priceOverride?: number }).priceOverride! > 0) {
            return (variant as { priceOverride?: number }).priceOverride!;
          }
          return product.price;
        });
      if (variantPrices.length === 0) {
        const productPrice =
          product.salePrice && product.salePrice > 0 ? product.salePrice : product.price;
        if (productPrice > filters.maxPrice) {
          return false;
        }
      } else if (Math.max(...variantPrices) > filters.maxPrice) {
        return false;
      }
    }
  }

  return true;
}

function parseCommaParam(
  param: string | string[] | undefined
): string[] {
  if (!param) return [];
  if (typeof param === "string") {
    return param.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return param.flatMap((p) =>
    typeof p === "string" ? p.split(",") : [String(p)]
  ).map((s) => s.trim()).filter(Boolean);
}

/** Map URL sort param to internal ProductSortOption. */
export function parseSortFromSearchParams(
  searchParams: { [key: string]: string | string[] | undefined }
): ProductSortOption {
  const sortParam = searchParams.sort;
  const sortValue =
    typeof sortParam === "string"
      ? sortParam
      : Array.isArray(sortParam)
        ? sortParam[0]
        : "";
  if (sortValue === "newest") return "newest";
  if (sortValue === "price-low" || sortValue === "priceAsc") return "priceAsc";
  if (sortValue === "price-high" || sortValue === "priceDesc") return "priceDesc";
  return "relevance";
}

/** URL param -> ProductFilters key, for the bag facets that are plain comma lists. */
const BAG_FACET_PARAMS = [
  "bagType",
  "intendedUse",
  "carryingOptions",
  "bagSizeCategory",
  "strapType",
  "closureType",
] as const

/** Parse color, size, price, sub-subcategory and bag facet filters from collection URL searchParams. */
export function parseFacetFiltersFromSearchParams(
  searchParams: { [key: string]: string | string[] | undefined }
): Pick<
  ProductFilters,
  | "color"
  | "size"
  | "subSubCategoryIds"
  | "minPrice"
  | "maxPrice"
  | (typeof BAG_FACET_PARAMS)[number]
  | "fitsA4"
> {
  const filters: Pick<
    ProductFilters,
    | "color"
    | "size"
    | "subSubCategoryIds"
    | "minPrice"
    | "maxPrice"
    | (typeof BAG_FACET_PARAMS)[number]
    | "fitsA4"
  > = {};

  for (const param of BAG_FACET_PARAMS) {
    const values = parseCommaParam(searchParams[param]);
    if (values.length > 0) {
      filters[param] = values;
    }
  }

  if (searchParams.fitsA4 === "1" || searchParams.fitsA4 === "true") {
    filters.fitsA4 = true;
  }

  const colors = parseCommaParam(searchParams.colors);
  if (colors.length > 0) {
    filters.color = colors;
  }

  const sizes = parseCommaParam(searchParams.sizes).map((s) => String(s).trim()).filter(Boolean);
  if (sizes.length > 0) {
    filters.size = sizes;
  }

  const subSubCategoryIds = parseCommaParam(searchParams.subSubCategories);
  if (subSubCategoryIds.length > 0) {
    filters.subSubCategoryIds = subSubCategoryIds;
  }

  const minPriceParam = searchParams.minPrice;
  if (minPriceParam) {
    const minPrice =
      typeof minPriceParam === "string"
        ? parseFloat(minPriceParam)
        : Array.isArray(minPriceParam)
          ? parseFloat(minPriceParam[0])
          : undefined;
    if (!Number.isNaN(minPrice!) && minPrice! > 0) {
      filters.minPrice = minPrice;
    }
  }

  const maxPriceParam = searchParams.maxPrice;
  if (maxPriceParam) {
    const maxPrice =
      typeof maxPriceParam === "string"
        ? parseFloat(maxPriceParam)
        : Array.isArray(maxPriceParam)
          ? parseFloat(maxPriceParam[0])
          : undefined;
    if (!Number.isNaN(maxPrice!) && maxPrice! > 0) {
      filters.maxPrice = maxPrice;
    }
  }

  return filters;
}

export function parsePageFromSearchParams(
  searchParams: { [key: string]: string | string[] | undefined }
): number {
  const pageParam = searchParams.page;
  if (!pageParam) return 1;
  const parsed =
    typeof pageParam === "string"
      ? parseInt(pageParam, 10)
      : Array.isArray(pageParam)
        ? parseInt(pageParam[0], 10)
        : 1;
  if (!Number.isNaN(parsed) && parsed > 0 && Number.isInteger(parsed)) {
    return parsed;
  }
  return 1;
}
