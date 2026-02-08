"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion as fmMotion, AnimatePresence } from "framer-motion";
import {
  FunnelIcon,
  XMarkIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";
import { Product, Category, productHelpers, VariantItem } from "@/lib/firebase";
import ProductCard from "@/app/components/ProductCard";
import { trackViewItemList } from "@/lib/dataLayer";
import { getColorName, getColorHex } from "@/lib/colors";
import { cn } from "@/lib/utils";
import ScrollToTopButton from "@/app/components/ScrollToTopButton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Slider } from '@/app/components/ui/slider';
import {
  getCollectionState,
  setCollectionState,
  type CollectionBrowseState,
} from "@/lib/collectionBrowseStore";

// NOTE: React 19 + Next 16 typecheck currently treats `motion.*` as not accepting
// animation props in this file. We cast it to avoid a build-blocking type error.
// (Runtime behavior remains unchanged.)
const motion = fmMotion as unknown as any;

// Translations for the collection page
const translations = {
  en: {
    home: "Home",
    allProducts: "All Products",
    women: "Women",
    men: "Men",
    products: "products",
    filters: "Filters",
    relevance: "Relevance",
    priceLow: "Price: Low to High",
    priceHigh: "Price: High to Low",
    newest: "Newest",
    noProductsFound: "No products found",
    tryAdjusting: "Try adjusting your filters or search criteria.",
    loadingProducts: "Loading products...",
    loading: "Loading...",
    showing: "Showing",
    of: "of",
    items: "items",
    loadMore: "Load More",
    price: "Price",
    minPrice: "Min Price",
    maxPrice: "Max Price",
    priceRange: "Price: ₪{min} – ₪{max}",
    colors: "Colors",
    sizes: "Sizes",
    clearAllFilters: "Clear All Filters",
    applyFilters: "Apply Filters",
    subcategoriesList: {
      shoes: "Shoes",
      accessories: "Accessories",
      highheels: "High Heels",
      boots: "Boots",
      oxford: "Oxford",
      sneakers: "Sneakers",
      sandals: "Sandals",
      slippers: "Slippers",
      coats: "Coats",
      bags: "Bags"
    },
    categoriesList: {
      women: "Women",
      men: "Men",
      allProducts: "All Products"
    }
  },
  he: {
    home: "בית",
    allProducts: "כל המוצרים",
    women: "נשים",
    men: "גברים",
    products: "מוצרים",
    filters: "סינון",
    relevance: "רלוונטיות",
    priceLow: "מחיר: נמוך לגבוה",
    priceHigh: "מחיר: גבוה לנמוך",
    newest: "החדשים ביותר",
    noProductsFound: "לא נמצאו מוצרים",
    tryAdjusting: "נסו להתאים את המסננים או קריטריוני החיפוש.",
    loadingProducts: "טוען מוצרים...",
    loading: "טוען...",
    showing: "מציג",
    of: "מתוך",
    items: "מוצרים",
    loadMore: "טען עוד",
    price: "מחיר",
    minPrice: "מחיר מינימלי",
    maxPrice: "מחיר מקסימלי",
    priceRange: "מחיר: ₪{min} – ₪{max}",
    colors: "צבעים",
    sizes: "מידות",
    clearAllFilters: "נקה את כל המסננים",
    applyFilters: "החל מסננים",
    subcategoriesList: {
      shoes: "נעליים",
      accessories: "אביזרים",
      highheels: "עקבים גבוהים",
      boots: "מגפיים",
      oxford: "אוקספורד",
      sneakers: "סניקרס",
      sandals: "סנדלים",
      slippers: "נעלי בית",
      coats: "מעילים",
      bags: "תיקים"
    },
    categoriesList: {
      women: "נשים",
      men: "גברים",
      allProducts: "כל המוצרים"
    }
  }
};

interface CollectionClientProps {
  initialProducts: Product[];
  initialVariantItems?: VariantItem[]; // New: variant items (one per color variant)
  categories: Category[];
  categoryPath: string | undefined;
  selectedCategory: string;
  selectedSubcategory: string | null;
  lng: string;
  searchQuery?: string;
  searchTotal?: number;
  searchPage?: number;
  hasMore?: boolean;
}

export default function CollectionClient({
  initialProducts,
  initialVariantItems,
  categories,
  categoryPath,
  selectedCategory,
  selectedSubcategory,
  lng,
  searchQuery,
  searchTotal,
  searchPage = 1,
  hasMore: initialHasMore = false,
}: CollectionClientProps) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = translations[lng as keyof typeof translations] || translations.en;

  // Determine current collection level from slug (needed early for handleLoadMore)
  const slug = params?.slug as string[] | undefined;

  // Use variantItems if available (collection pages), otherwise fall back to products (search)
  const useVariantItems = initialVariantItems !== undefined && !searchQuery;
  
  // Pagination state - accumulated variant items or products stream (never replaced, only appended)
  const [allVariantItems, setAllVariantItems] = useState<VariantItem[]>(initialVariantItems || []);
  const [allProducts, setAllProducts] = useState<Product[]>(initialProducts);
  const [currentPage, setCurrentPage] = useState(searchPage || 1);
  const [totalProducts, setTotalProducts] = useState(searchTotal ?? (useVariantItems ? (initialVariantItems?.length ?? 0) : initialProducts.length));
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Track filter/search key to detect when filters actually change (not just page)
  const filterKey = useMemo(() => {
    const safeSearchParams = searchParams ?? new URLSearchParams();
    // Build a key from all filter/search params except page
    const keyParts: string[] = [];
    if (categoryPath) keyParts.push(`cat:${categoryPath}`);
    if (searchQuery) keyParts.push(`search:${searchQuery}`);
    safeSearchParams.forEach((value, key) => {
      if (key !== 'page' && key !== 'search') {
        keyParts.push(`${key}:${value}`);
      }
    });
    return keyParts.sort().join('|');
  }, [categoryPath, searchQuery, searchParams]);

  // Stable key for this collection + filter/search combination
  const collectionKey = useMemo(() => {
    const base = `${lng}|${categoryPath || 'all'}|${searchQuery || ''}`;
    return `${base}|${filterKey}`;
  }, [lng, categoryPath, searchQuery, filterKey]);

  // Track previous filter key to detect filter changes (not page changes)
  const prevFilterKeyRef = useRef<string>('');
  const isInitialMountRef = useRef<boolean>(true);
  const isLoadingMoreRef = useRef<boolean>(false);
  const scrollRestoredRef = useRef<boolean>(false);
  const hydratedFromStoreRef = useRef<boolean>(false);
  const restoredFromUrlFetchRef = useRef<boolean>(false);

  // Initialize on mount only - set initial state
  useEffect(() => {
    if (isInitialMountRef.current) {
      prevFilterKeyRef.current = filterKey;
      isInitialMountRef.current = false;
    }
  }, []); // Empty deps - only run once on mount

  // Ref to persist latest state on unmount (navigate away to PDP)
  const stateSnapshotRef = useRef<{
    useVariantItems: boolean;
    items: VariantItem[] | Product[];
    currentPage: number;
    totalProducts: number;
    hasMore: boolean;
  } | null>(null);

  // Hydrate pagination/items state from the per-collection store when available.
  useEffect(() => {
    if (!collectionKey || hydratedFromStoreRef.current) return;

    const stored = getCollectionState(collectionKey);
    if (!stored) return;

    hydratedFromStoreRef.current = true;

    if (stored.useVariantItems) {
      setAllVariantItems(stored.items as VariantItem[]);
    } else {
      setAllProducts(stored.items as Product[]);
    }

    setCurrentPage(stored.currentPage);
    setTotalProducts(stored.totalProducts);
    setHasMore(stored.hasMore);
  }, [collectionKey]);

  // Fallback: when URL has page>1 but no stored state (e.g. sessionStorage failed or new tab),
  // fetch pages 1..page on the client and restore the list so we show the same place.
  useEffect(() => {
    if (!collectionKey || hydratedFromStoreRef.current || restoredFromUrlFetchRef.current) return;

    const pageParam = searchParams?.get("page");
    const targetPage = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
    if (targetPage < 2) return;

    restoredFromUrlFetchRef.current = true;
    const safeSearchParams = searchParams ?? new URLSearchParams();

    const fetchPage = (page: number): Promise<{ variantItems?: VariantItem[]; items?: Product[]; total?: number; hasMore?: boolean }> => {
      const apiUrl = new URL("/api/products/collection", window.location.origin);
      apiUrl.searchParams.set("page", String(page));
      apiUrl.searchParams.set("language", lng);
      if (categoryPath) apiUrl.searchParams.set("categoryPath", categoryPath);
      if (searchQuery) apiUrl.searchParams.set("search", searchQuery);
      safeSearchParams.forEach((value, key) => {
        if (key !== "page" && key !== "search") apiUrl.searchParams.set(key, value);
      });
      return fetch(apiUrl.toString()).then((r) => (r.ok ? r.json() : Promise.resolve({})));
    };

    if (useVariantItems) {
      Promise.all(Array.from({ length: targetPage }, (_, i) => fetchPage(i + 1)))
        .then((results) => {
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
          if (combined.length > 0) {
            setAllVariantItems(combined);
            setCurrentPage(targetPage);
            setTotalProducts(total || combined.length);
            setHasMore(!!hasMore);
          }
        })
        .catch(() => { restoredFromUrlFetchRef.current = false; });
    } else {
      Promise.all(Array.from({ length: targetPage }, (_, i) => fetchPage(i + 1)))
        .then((results) => {
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
              const id = item.id ?? item.sku;
              if (id && !allIds.has(String(id))) {
                allIds.add(String(id));
                combined.push(item);
              }
            });
          }
          if (combined.length > 0) {
            setAllProducts(combined);
            setCurrentPage(targetPage);
            setTotalProducts(total || combined.length);
            setHasMore(!!hasMore);
          }
        })
        .catch(() => { restoredFromUrlFetchRef.current = false; });
    }
  }, [collectionKey, categoryPath, searchQuery, lng, searchParams, useVariantItems]);

  // CRITICAL: Only reset products/variantItems when filters/search actually change, NOT when page changes
  // Do NOT overwrite when we just hydrated from store (returning from PDP with restored state).
  useEffect(() => {
    const filterChanged = prevFilterKeyRef.current !== filterKey;
    
    // Only reset if:
    // 1. Filters actually changed (not just page number) 
    // 2. We're NOT in the middle of loading more
    // 3. This is not just a page number change (check if page is the only thing that changed)
    const pageOnlyChanged = !filterChanged && prevFilterKeyRef.current !== '';
    
    if (filterChanged && !isLoadingMoreRef.current) {
      hydratedFromStoreRef.current = false; // New filter context, clear hydration flag
      // Filters/search changed - reset accumulated items to start fresh
      if (useVariantItems && initialVariantItems) {
        setAllVariantItems(initialVariantItems);
        setTotalProducts(searchTotal ?? initialVariantItems.length);
      } else {
        setAllProducts(initialProducts);
        setTotalProducts(searchTotal ?? initialProducts.length);
      }
      setCurrentPage(searchPage || 1);
      setHasMore(initialHasMore);
      prevFilterKeyRef.current = filterKey;
    } else if (pageOnlyChanged && !isLoadingMoreRef.current && !hydratedFromStoreRef.current) {
      // Only page number changed - sync to server data ONLY if we did NOT hydrate from store.
      // When returning from PDP we hydrate from store and must not overwrite with server payload.
      if (searchPage && searchPage !== currentPage) {
        if (useVariantItems && initialVariantItems) {
          setAllVariantItems(initialVariantItems);
          setTotalProducts(searchTotal ?? initialVariantItems.length);
        } else {
          setAllProducts(initialProducts);
          setTotalProducts(searchTotal ?? initialProducts.length);
        }
        setCurrentPage(searchPage);
        setHasMore(initialHasMore);
      }
    }
    // If filterKey hasn't changed and we're loading more, DON'T RESET!
    // The accumulated stream should remain intact
  }, [filterKey, initialProducts, initialVariantItems, searchPage, searchTotal, initialHasMore, currentPage, useVariantItems]);

  // Keep snapshot ref updated so we can persist on unmount
  stateSnapshotRef.current = {
    useVariantItems,
    items: useVariantItems ? allVariantItems : allProducts,
    currentPage,
    totalProducts,
    hasMore,
  };

  // Persist to store on unmount (navigating away to product page) so state is never lost
  useEffect(() => {
    return () => {
      const key = collectionKey;
      const snap = stateSnapshotRef.current;
      if (!key || !snap) return;
      const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
      setCollectionState(key, {
        useVariantItems: snap.useVariantItems,
        items: snap.items,
        currentPage: snap.currentPage,
        totalProducts: snap.totalProducts,
        hasMore: snap.hasMore,
        scrollY,
        updatedAt: Date.now(),
      });
    };
  }, [collectionKey]);

  // Helper: persist current collection state (including latest scrollY) into the store.
  const persistCollectionState = useCallback(
    (scrollYOverride?: number) => {
      if (!collectionKey) return;

      const scrollY =
        typeof window !== "undefined"
          ? scrollYOverride ?? window.scrollY
          : scrollYOverride ?? 0;

      const state: CollectionBrowseState = {
        useVariantItems,
        items: useVariantItems ? allVariantItems : allProducts,
        currentPage,
        totalProducts,
        hasMore,
        scrollY,
        updatedAt: Date.now(),
      };

      setCollectionState(collectionKey, state);
    },
    [
      collectionKey,
      useVariantItems,
      allVariantItems,
      allProducts,
      currentPage,
      totalProducts,
      hasMore,
    ]
  );

  // Persist scroll position into the store while the user scrolls.
  useEffect(() => {
    if (!collectionKey) return;

    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        persistCollectionState();
      }, 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [collectionKey, persistCollectionState]);

  // Ensure latest state is stored when core pagination data changes.
  useEffect(() => {
    if (!collectionKey) return;
    persistCollectionState();
  }, [
    collectionKey,
    persistCollectionState,
    useVariantItems,
    allVariantItems,
    allProducts,
    currentPage,
    totalProducts,
    hasMore,
  ]);

  // Load More handler
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    // CRITICAL: Preserve scroll position before any DOM changes
    // Store current scroll position to restore after new items are rendered
    const scrollYBefore = window.scrollY;
    const scrollXBefore = window.scrollX;

    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      
      // Build API URL with all current filters
      const apiUrl = new URL('/api/products/collection', window.location.origin);
      apiUrl.searchParams.set('page', nextPage.toString());
      apiUrl.searchParams.set('language', lng);
      
      if (categoryPath) {
        apiUrl.searchParams.set('categoryPath', categoryPath);
      }
      
      if (searchQuery) {
        apiUrl.searchParams.set('search', searchQuery);
      }

      // Add all current filter params
      const safeSearchParams = searchParams ?? new URLSearchParams();
      safeSearchParams.forEach((value, key) => {
        if (key !== 'page' && key !== 'search') {
          apiUrl.searchParams.set(key, value);
        }
      });

      const response = await fetch(apiUrl.toString());
      if (!response.ok) {
        throw new Error('Failed to load more products');
      }

      const data = await response.json();
      
      // Handle variantItems (collection pages) or items (search)
      if (useVariantItems && data.variantItems) {
        const newVariantItems = data.variantItems || [];
        
        if (newVariantItems.length === 0) {
          // No new items - update hasMore and exit
          setHasMore(false);
          setIsLoadingMore(false);
          return;
        }
        
        // Prevent duplicates by checking existing variant keys (Set-based deduplication)
        // This ensures stable stream even if API returns overlapping results
        setAllVariantItems(prev => {
          const existingVariantKeys = new Set(prev.map(item => item.variantKey));
          const uniqueNewItems = newVariantItems.filter((item: VariantItem) => !existingVariantKeys.has(item.variantKey));
          
          if (uniqueNewItems.length === 0) {
            console.warn('All fetched variant items were duplicates, skipping append');
            return prev; // Return unchanged if all duplicates
          }
          
          // CRITICAL: Append new variant items (NEVER replace!)
          return [...prev, ...uniqueNewItems];
        });
      } else {
        // Fallback to products (for search)
        const newItems = data.items || [];
        
        if (newItems.length === 0) {
          // No new items - update hasMore and exit
          setHasMore(false);
          setIsLoadingMore(false);
          return;
        }
        
        // Prevent duplicates by checking existing product IDs
        // This ensures stable stream even if API returns overlapping results
        setAllProducts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNewItems = newItems.filter((item: Product) => !existingIds.has(item.id));
          
          if (uniqueNewItems.length === 0) {
            console.warn('All fetched items were duplicates, skipping append');
            return prev; // Return unchanged if all duplicates
          }
          
          // CRITICAL: Append new products (NEVER replace!)
          return [...prev, ...uniqueNewItems];
        });
      }
      
      // Set flag BEFORE updating URL to prevent useEffect from resetting
      isLoadingMoreRef.current = true;
      
      // Update pagination metadata
      setCurrentPage(data.page || nextPage);
      setTotalProducts(data.total || totalProducts);
      setHasMore(data.hasMore || false);

      // Update URL with new page number - use window.history to avoid server re-render
      // This keeps URL in sync for sharing/refresh without triggering Next.js server fetch
      // Using replaceState prevents scroll restoration that Next.js router might trigger
      const urlParams = new URLSearchParams(safeSearchParams.toString());
      urlParams.set('page', nextPage.toString());
      const queryString = urlParams.toString();
      const currentPath = `/${lng}/collection${slug ? '/' + slug.join('/') : ''}`;
      const newUrl = queryString ? `${currentPath}?${queryString}` : currentPath;
      
      // Use window.history.replaceState to update URL without triggering server re-render or scroll
      // This is critical - router.replace() can trigger server re-fetch and scroll restoration
      window.history.replaceState(
        { ...window.history.state, as: newUrl, url: newUrl },
        '',
        newUrl
      );
      
      // CRITICAL: Restore scroll position after React renders new items
      // Use requestAnimationFrame to ensure DOM has updated with new products
      // Multiple rAF calls ensure we restore after layout is complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Restore exact scroll position to prevent any jump
          window.scrollTo({
            top: scrollYBefore,
            left: scrollXBefore,
            behavior: 'auto' // Instant, no smooth scroll
          });
        });
      });
      
      // Reset flag after URL update completes
      // This allows useEffect to run normally for future filter changes
      setTimeout(() => {
        isLoadingMoreRef.current = false;
      }, 200);
    } catch (error) {
      console.error('Error loading more products:', error);
      // Restore scroll even on error
      requestAnimationFrame(() => {
        window.scrollTo({
          top: scrollYBefore,
          left: scrollXBefore,
          behavior: 'auto'
        });
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, currentPage, categoryPath, searchQuery, lng, searchParams, router, slug, totalProducts, useVariantItems]);
  const collectionLevel = slug ? slug.length : 0; // 0 = all/main, 1 = level 0, 2 = level 1, 3+ = level 2+
  const showSubSubCategoryFilter = collectionLevel <= 2; // Show only on level 0 and level 1 pages

  // Construct current collection URL for return navigation
  const currentUrl = `/${lng}/collection${categoryPath ? `/${categoryPath}` : ''}`;

  // Helper function to get translated category/subcategory name
  const getTranslatedName = (category: string | undefined, subcategory?: string | null) => {
    // If search query exists, show search results title instead
    if (searchQuery) {
      return '';
    }

    if (subcategory) {
      const subCategoryCapitalized = subcategory.charAt(0).toUpperCase() + subcategory.slice(1);
      return subCategoryCapitalized;
    }

    if (!category) {
      return lng === 'he' ? 'כל המוצרים' : 'All Products';
    }

    const categoryKey = category.toLowerCase();
    const translatedCategory = t.categoriesList[categoryKey as keyof typeof t.categoriesList];
    return translatedCategory || category.charAt(0).toUpperCase() + category.slice(1);
  };

  // Initialize filter state from URL searchParams
  const safeSearchParams = searchParams ?? new URLSearchParams();

  const [selectedColors, setSelectedColors] = useState<string[]>(() => {
    const colorsParam = safeSearchParams.get('colors');
    return colorsParam ? colorsParam.split(',').filter(Boolean) : [];
  });

  const [selectedSizes, setSelectedSizes] = useState<string[]>(() => {
    const sizesParam = safeSearchParams.get('sizes');
    return sizesParam ? sizesParam.split(',').filter(Boolean) : [];
  });

  // Add state for selected sub-sub categories
  const [selectedSubSubCategories, setSelectedSubSubCategories] = useState<string[]>(() => {
    const subSubCategoriesParam = safeSearchParams.get('subSubCategories');
    return subSubCategoriesParam ? subSubCategoriesParam.split(',').filter(Boolean) : [];
  });

  const [sortBy, setSortBy] = useState<string>(() => {
    return safeSearchParams.get('sort') || 'relevance';
  });

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);
  
  // Controlled state for accordion sections (desktop and mobile)
  // Using array to allow multiple sections open simultaneously
  const [desktopAccordionValue, setDesktopAccordionValue] = useState<string[]>([]);
  const [mobileAccordionValue, setMobileAccordionValue] = useState<string[]>([]);

  // Auto-open accordion sections that have active filters when filter panel opens

  // Update URL when filters change
  const updateURL = (newFilters: {
    colors?: string[];
    sizes?: string[];
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    subSubCategories?: string[];
  }, resetPage: boolean = true) => {
    // Start with current search params to preserve search query
    const urlParams = new URLSearchParams(safeSearchParams.toString());
    
    // Reset page to 1 when filters change (user expects to see filtered results from start)
    if (resetPage) {
      urlParams.delete('page');
    }
    
    // Remove filter params that we're about to update (so we can reset them)
    urlParams.delete('colors');
    urlParams.delete('sizes');
    urlParams.delete('minPrice');
    urlParams.delete('maxPrice');
    urlParams.delete('sort');
    urlParams.delete('subSubCategories');
    
    // Add back only the filter params that have values
    if (newFilters.colors && newFilters.colors.length > 0) {
      urlParams.set('colors', newFilters.colors.join(','));
    }
    if (newFilters.sizes && newFilters.sizes.length > 0) {
      urlParams.set('sizes', newFilters.sizes.join(','));
    }
    if (newFilters.subSubCategories && newFilters.subSubCategories.length > 0) {
      urlParams.set('subSubCategories', newFilters.subSubCategories.join(','));
    }
    // Explicitly handle price params - if they're provided (even as empty string), set or remove them
    if (newFilters.minPrice !== undefined) {
      if (newFilters.minPrice && newFilters.minPrice.trim() !== '') {
        urlParams.set('minPrice', newFilters.minPrice);
      }
      // If empty string, don't set it (it will be removed from URL)
    }
    if (newFilters.maxPrice !== undefined) {
      if (newFilters.maxPrice && newFilters.maxPrice.trim() !== '') {
        urlParams.set('maxPrice', newFilters.maxPrice);
      }
      // If empty string, don't set it (it will be removed from URL)
    }
    if (newFilters.sort && newFilters.sort !== 'relevance') {
      urlParams.set('sort', newFilters.sort);
    }
    
    const queryString = urlParams.toString();
    const currentPath = `/${lng}/collection${slug ? '/' + slug.join('/') : ''}`;
    const newUrl = queryString ? `${currentPath}?${queryString}` : currentPath;
    
    router.push(newUrl, { scroll: false });
  };

  // Handle filter changes
  const handleColorToggle = (color: string) => {
    const newColors = selectedColors.includes(color)
      ? selectedColors.filter((c) => c !== color)
      : [...selectedColors, color];
    setSelectedColors(newColors);
    // Use current UI range for URL update
    const { minStr, maxStr } = rangeToUrlParams(uiRange);
    updateURL({ 
      minPrice: minStr, 
      maxPrice: maxStr, 
      colors: newColors, 
      sizes: selectedSizes, 
      sort: sortBy,
      subSubCategories: selectedSubSubCategories
    });
  };

  const handleSizeToggle = (size: string) => {
    const newSizes = selectedSizes.includes(size)
      ? selectedSizes.filter((s) => s !== size)
      : [...selectedSizes, size];
    setSelectedSizes(newSizes);
    // Use current UI range for URL update
    const { minStr, maxStr } = rangeToUrlParams(uiRange);
    updateURL({ 
      minPrice: minStr, 
      maxPrice: maxStr, 
      colors: selectedColors, 
      sizes: newSizes, 
      sort: sortBy,
      subSubCategories: selectedSubSubCategories
    });
  };

  // Handle sub-sub category toggle
  const handleSubSubCategoryToggle = (categoryId: string) => {
    const newSubSubCategories = selectedSubSubCategories.includes(categoryId)
      ? selectedSubSubCategories.filter((id) => id !== categoryId)
      : [...selectedSubSubCategories, categoryId];
    setSelectedSubSubCategories(newSubSubCategories);
    // Use current UI range for URL update
    const { minStr, maxStr } = rangeToUrlParams(uiRange);
    updateURL({ 
      minPrice: minStr, 
      maxPrice: maxStr, 
      colors: selectedColors, 
      sizes: selectedSizes, 
      sort: sortBy,
      subSubCategories: newSubSubCategories
    });
  };

  // Helper to convert range to URL params
  // Always use the actual range values - server will handle filtering
  const rangeToUrlParams = (range: [number, number]) => {
    const minStr = String(Math.round(range[0]));
    const maxStr = String(Math.round(range[1]));
    
    return { minStr, maxStr };
  };

  // LIVE UI: Update slider and label instantly while dragging (no URL update)
  const handleSliderChange = (values: number[]) => {
    const [min, max] = values;
    
    // Only ensure min <= max (do NOT clamp to collection bounds)
    // Allow user to set values outside collection range
    const validatedMin = Math.min(min, max);
    const validatedMax = Math.max(min, max);
    
    // Update UI state immediately (slider moves smoothly)
    setUiRange([validatedMin, validatedMax]);
  };

  // COMMIT: Update URL when user releases slider (only place URL is updated)
  const handleSliderCommit = (values: number[]) => {
    const [min, max] = values as [number, number];
    
    // Only ensure min <= max (do NOT clamp to collection bounds)
    // Allow user to set values outside collection range
    const finalRange: [number, number] = [
      Math.min(min, max),
      Math.max(min, max),
    ];
    
    // Update UI state to final range
    setUiRange(finalRange);
    
    // Mark that we're committing (prevents URL sync effect from running)
    isCommittingRef.current = true;
    
    // Convert to URL params and update URL
    const { minStr, maxStr } = rangeToUrlParams(finalRange);
    
    updateURL({
      minPrice: minStr,
      maxPrice: maxStr,
      colors: selectedColors,
      sizes: selectedSizes,
      sort: sortBy,
      subSubCategories: selectedSubSubCategories,
    });
  };

  // Reset: Immediately commit full bounds to URL
  const handlePriceReset = () => {
    const boundsMin = collectionPriceBounds?.min ?? 0;
    const boundsMax = collectionPriceBounds?.max ?? 1000;
    const full: [number, number] = [boundsMin, boundsMax];
    
    // Update UI immediately
    setUiRange(full);
    
    // Mark that we're committing
    isCommittingRef.current = true;
    
    // Immediately commit to URL (no debounce)
    updateURL({
      minPrice: "",
      maxPrice: "",
      colors: selectedColors,
      sizes: selectedSizes,
      sort: sortBy,
      subSubCategories: selectedSubSubCategories,
    });
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    // Use current UI range for URL update
    const { minStr, maxStr } = rangeToUrlParams(uiRange);
    updateURL({ 
      minPrice: minStr, 
      maxPrice: maxStr, 
      colors: selectedColors, 
      sizes: selectedSizes, 
      sort: newSort,
      subSubCategories: selectedSubSubCategories
    });
  };

  const handleClearFilters = () => {
    setSelectedColors([]);
    setSelectedSizes([]);
    setSelectedSubSubCategories([]);
    setSortBy('relevance');
    
    const boundsMin = collectionPriceBounds?.min ?? 0;
    const boundsMax = collectionPriceBounds?.max ?? 1000;
    const full: [number, number] = [boundsMin, boundsMax];
    
    // Update UI immediately
    setUiRange(full);
    
    // Clear all filters in URL
    updateURL({ 
      minPrice: '', 
      maxPrice: '', 
      colors: [], 
      sizes: [], 
      sort: 'relevance',
      subSubCategories: []
    });
  };


  // Apply sorting to variant items or products (items are already filtered server-side)
  const sortedItems = useMemo(() => {
    if (useVariantItems) {
      // Sort variant items
      const sorted = [...allVariantItems].sort((a, b) => {
        // Get variant-specific price for comparison
        const getVariantPrice = (item: VariantItem): number => {
          if (item.variant.salePrice && item.variant.salePrice > 0) return item.variant.salePrice;
          if (item.product.salePrice && item.product.salePrice > 0) return item.product.salePrice;
          if (item.variant.priceOverride && item.variant.priceOverride > 0) return item.variant.priceOverride;
          return item.product.price;
        };
        
        switch (sortBy) {
          case "price-low":
            return getVariantPrice(a) - getVariantPrice(b);
          case "price-high":
            return getVariantPrice(b) - getVariantPrice(a);
          case "newest":
            // Sort by product createdAt (all variants of same product have same date)
            const dateA = a.product.createdAt ? new Date(a.product.createdAt).getTime() : 0;
            const dateB = b.product.createdAt ? new Date(b.product.createdAt).getTime() : 0;
            return dateB - dateA; // Newest first
          case "relevance":
          default:
            // Keep server-side order (already sorted by createdAt desc)
            return 0;
        }
      });
      return sorted;
    } else {
      // Sort products (for search)
      const sorted = [...allProducts].sort((a, b) => {
        const priceA = (a.salePrice && a.salePrice > 0) ? a.salePrice : a.price;
        const priceB = (b.salePrice && b.salePrice > 0) ? b.salePrice : b.price;
        
        switch (sortBy) {
          case "price-low":
            return priceA - priceB;
          case "price-high":
            return priceB - priceA;
          case "newest":
            if (a.createdAt && b.createdAt) {
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            const aId = typeof a.id === 'string' ? parseInt(a.id) : (typeof a.id === 'number' ? a.id : 0);
            const bId = typeof b.id === 'string' ? parseInt(b.id) : (typeof b.id === 'number' ? b.id : 0);
            return bId - aId;
          case "relevance":
          default:
            return 0;
        }
      });
      return sorted;
    }
  }, [allVariantItems, allProducts, sortBy, useVariantItems]);

  // Scroll restoration: use stored scrollY for this collection key when returning from PDP.
  useEffect(() => {
    if (!collectionKey || scrollRestoredRef.current) return;

    const stored = getCollectionState(collectionKey);
    if (!stored || stored.scrollY <= 0) {
      scrollRestoredRef.current = true;
      return;
    }

    // Wait until items are rendered to avoid restoring too early.
    if (sortedItems.length === 0) return;

    scrollRestoredRef.current = true;
    const targetY = stored.scrollY;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, targetY);
      });
    });
  }, [collectionKey, sortedItems.length]);

  // Track view_item_list when items are displayed
  useEffect(() => {
    if (sortedItems.length === 0) return;

    try {
      const listName = categoryPath || selectedCategory || 'All Products';
      const listId = categoryPath || selectedCategory || 'all_products';
      
      const items = useVariantItems
        ? (sortedItems as VariantItem[]).map((item) => {
            // Track each variant item separately
            const price = item.variant.salePrice || item.product.salePrice || item.variant.priceOverride || item.product.price;
            const productName = productHelpers.getField(item.product, 'name', lng as 'en' | 'he') || item.product.title_en || item.product.title_he || 'Unknown Product';
            const categories = item.product.categories_path || [item.product.category || 'Unknown'];
            
            return {
              name: productName,
              id: `${item.product.sku || item.product.id || ''}-${item.variant.colorSlug}`,
              price: price,
              brand: item.product.brand,
              categories: categories,
              variant: item.variant.colorSlug
            };
          })
        : (sortedItems as Product[]).map((product) => {
            // Track products (for search)
            const firstVariant = product.colorVariants 
              ? Object.values(product.colorVariants).find(v => v.isActive !== false)
              : null;
            
            const price = firstVariant?.salePrice || firstVariant?.priceOverride || product.salePrice || product.price;
            const variant = firstVariant?.colorSlug || '';
            const productName = productHelpers.getField(product, 'name', lng as 'en' | 'he') || product.title_en || product.title_he || 'Unknown Product';
            const categories = product.categories_path || [product.category || 'Unknown'];
            
            return {
              name: productName,
              id: product.sku || product.id || '',
              price: price,
              brand: product.brand,
              categories: categories,
              variant: variant
            };
          });

      trackViewItemList(items, listName, listId, 'ILS');
    } catch (dataLayerError) {
      console.warn('Data layer tracking error:', dataLayerError);
    }
  }, [sortedItems, categoryPath, selectedCategory, lng, useVariantItems]);

  // Build dynamic color mapping from variant items or products (includes colorHex when available)
  // This prioritizes colorHex from variants, then falls back to getColorHex
  const colorSlugToHex = useMemo(() => {
    const map: Record<string, string> = {};
    
    if (useVariantItems && initialVariantItems) {
      // Extract color info from variant items
      initialVariantItems.forEach((item) => {
        if (item.variant.isActive !== false && item.variant.colorSlug) {
          // Use colorHex from variant if available, otherwise use getColorHex
          if ((item.variant as any).colorHex) {
            map[item.variant.colorSlug] = (item.variant as any).colorHex;
          } else {
            map[item.variant.colorSlug] = getColorHex(item.variant.colorSlug);
          }
        }
      });
    } else {
      // Extract color info from products (for search)
      initialProducts.forEach((product) => {
        if (product.colorVariants) {
          Object.values(product.colorVariants).forEach((variant) => {
            if (variant.isActive !== false && variant.colorSlug) {
              // Use colorHex from variant if available, otherwise use getColorHex
              if ((variant as any).colorHex) {
                map[variant.colorSlug] = (variant as any).colorHex;
              } else {
                map[variant.colorSlug] = getColorHex(variant.colorSlug);
              }
            }
          });
        }
      });
    }
    
    return map;
  }, [initialProducts, initialVariantItems, useVariantItems]);

  // Get all colors and sizes from the filtered variant items or products
  const allColors = useMemo(() => {
    if (useVariantItems && initialVariantItems) {
      return [
        ...new Set(
          initialVariantItems
            .filter(item => item.variant.isActive !== false && item.variant.colorSlug)
            .map(item => item.variant.colorSlug)
            .filter(Boolean)
        ),
      ] as string[];
    } else {
      return [
        ...new Set([
          ...initialProducts.flatMap((p) => 
            p.colorVariants 
              ? Object.values(p.colorVariants)
                  .filter(v => v.isActive !== false)
                  .map((v) => v.colorSlug)
                  .filter(Boolean)
              : []
          )
        ]),
      ] as string[];
    }
  }, [initialProducts, initialVariantItems, useVariantItems]);

  const allSizes = useMemo(() => {
    if (useVariantItems && initialVariantItems) {
      return [
        ...new Set(
          initialVariantItems
            .filter(item => item.variant.isActive !== false)
            .flatMap((item) => Object.keys(item.variant.stockBySize || {}))
        ),
      ] as string[];
    } else {
      return [
        ...new Set([
          ...initialProducts.flatMap((p) => 
            p.colorVariants 
              ? Object.values(p.colorVariants)
                  .filter(v => v.isActive !== false)
                  .flatMap((v) => Object.keys(v.stockBySize || {}))
              : []
          ),
        ]),
      ] as string[];
    }
  }, [initialProducts, initialVariantItems, useVariantItems]);

  // Separate numeric sizes (shoes) from alpha sizes (clothing)
  const numericSizes = allSizes.filter(size => /^\d+(\.\d+)?$/.test(size)).sort((a, b) => parseFloat(a) - parseFloat(b));
  const alphaSizes = allSizes.filter(size => !/^\d+(\.\d+)?$/.test(size)).sort();

  // Get all sub-sub categories (level 2) grouped by parent
  const subSubCategoriesByParent = useMemo(() => {
    const grouped: Record<string, Category[]> = {};
    
    // On level 1 pages, find the current subcategory ID to filter sub-subcategories
    let currentSubcategoryId: string | undefined;
    if (collectionLevel === 2 && selectedSubcategory) {
      // Find the subcategory by matching slug (case-insensitive)
      const subcategorySlug = selectedSubcategory.toLowerCase();
      const foundSubcategory = categories.find(cat => {
        if (cat.level !== 1 || !cat.isEnabled) return false;
        const slugEn = typeof cat.slug === 'object' ? cat.slug.en : cat.slug;
        const slugHe = typeof cat.slug === 'object' ? cat.slug.he : cat.slug;
        return slugEn?.toLowerCase() === subcategorySlug || slugHe?.toLowerCase() === subcategorySlug;
      });
      currentSubcategoryId = foundSubcategory?.id;
    }
    
    // Get all sub-sub categories (level 2) that are enabled
    let subSubCategories = categories.filter(
      cat => cat.level === 2 && cat.isEnabled && cat.id
    );
    
    // On level 1 pages, filter to only show sub-subcategories of the current subcategory
    if (collectionLevel === 2 && currentSubcategoryId) {
      subSubCategories = subSubCategories.filter(
        cat => cat.parentId === currentSubcategoryId
      );
    }
    
    // Group by parent category
    subSubCategories.forEach(cat => {
      if (cat.parentId) {
        if (!grouped[cat.parentId]) {
          grouped[cat.parentId] = [];
        }
        grouped[cat.parentId].push(cat);
      }
    });
    
    // Sort each group by sortOrder
    Object.keys(grouped).forEach(parentId => {
      grouped[parentId].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    });
    
    return grouped;
  }, [categories, collectionLevel, selectedSubcategory]);

  // Get parent category name for display
  const getParentCategoryName = (parentId: string): string => {
    const parent = categories.find(cat => cat.id === parentId);
    if (!parent) return '';
    return lng === 'he' ? parent.name.he : parent.name.en;
  };

  // Get sub-sub category name based on language
  const getSubSubCategoryName = (category: Category): string => {
    return lng === 'he' ? category.name.he : category.name.en;
  };

  // STATIC: Collection Price Bounds - calculated from ALL variant items or products in collection
  // These represent the full available range and NEVER change when user drags slider
  const collectionPriceBounds = useMemo(() => {
    const prices: number[] = [];
    
    if (useVariantItems && initialVariantItems) {
      // Calculate from variant items
      if (initialVariantItems.length === 0) {
        return { min: 0, max: 1000 };
      }
      
      initialVariantItems.forEach((item) => {
        if (item.variant.isActive !== false) {
          // Priority: variant.salePrice > product.salePrice > variant.priceOverride > product.price
          if (item.variant.salePrice && item.variant.salePrice > 0) {
            prices.push(item.variant.salePrice);
          } else if (item.product.salePrice && item.product.salePrice > 0) {
            prices.push(item.product.salePrice);
          } else if (item.variant.priceOverride && item.variant.priceOverride > 0) {
            prices.push(item.variant.priceOverride);
          } else {
            prices.push(item.product.price);
          }
        }
      });
    } else {
      // Calculate from products (for search)
      if (initialProducts.length === 0) {
        return { min: 0, max: 1000 };
      }

      initialProducts.forEach((product) => {
        if (product.colorVariants && Object.keys(product.colorVariants).length > 0) {
          // Get prices from all active variants
          Object.values(product.colorVariants)
            .filter(v => v.isActive !== false)
            .forEach((variant) => {
              // Priority: variant.salePrice > product.salePrice > variant.priceOverride > product.price
              if ((variant as any).salePrice && (variant as any).salePrice > 0) {
                prices.push((variant as any).salePrice);
              } else if (product.salePrice && product.salePrice > 0) {
                prices.push(product.salePrice);
              } else if ((variant as any).priceOverride && (variant as any).priceOverride > 0) {
                prices.push((variant as any).priceOverride);
              } else {
                prices.push(product.price);
              }
            });
        } else {
          // No variants, use product-level price
          const productPrice = product.salePrice && product.salePrice > 0 ? product.salePrice : product.price;
          prices.push(productPrice);
        }
      });
    }

    if (prices.length === 0) {
      return { min: 0, max: 1000 };
    }

    const min = Math.floor(Math.min(...prices));
    const max = Math.ceil(Math.max(...prices));
    
    // Round to nice numbers
    const minRounded = Math.floor(min / 10) * 10;
    const maxRounded = Math.ceil(max / 10) * 10;
    
    return { min: minRounded, max: maxRounded };
  }, [initialProducts, initialVariantItems, useVariantItems]);

  // UI State: Live price range for slider (updates instantly while dragging)
  // Single source of truth for slider UI - no separate draft/applied states
  const [uiRange, setUiRange] = useState<[number, number]>(() => {
    // Initialize from URL params or default to full collection bounds
    // DO NOT clamp to bounds - allow user to set values outside collection range
    const urlMinStr = safeSearchParams.get('minPrice') || '';
    const urlMaxStr = safeSearchParams.get('maxPrice') || '';
    const boundsMin = collectionPriceBounds?.min ?? 0;
    const boundsMax = collectionPriceBounds?.max ?? 1000;
    
    // Use URL values directly, or default to bounds if not set
    const urlMin = urlMinStr ? parseFloat(urlMinStr) : boundsMin;
    const urlMax = urlMaxStr ? parseFloat(urlMaxStr) : boundsMax;
    
    // Only validate that values are numbers and min <= max (no clamping to bounds)
    const validMin = isNaN(urlMin) ? boundsMin : urlMin;
    const validMax = isNaN(urlMax) ? boundsMax : urlMax;
    
    return [Math.min(validMin, validMax), Math.max(validMin, validMax)];
  });

  // Re-initialize uiRange when collectionPriceBounds becomes available (if it was undefined during initial render)
  useEffect(() => {
    if (!collectionPriceBounds) return; // Wait for bounds to be computed
    
    const urlMinStr = safeSearchParams.get('minPrice') || '';
    const urlMaxStr = safeSearchParams.get('maxPrice') || '';
    const boundsMin = collectionPriceBounds.min;
    const boundsMax = collectionPriceBounds.max;
    
    // Use URL values directly, or default to bounds if not set
    const urlMin = urlMinStr ? parseFloat(urlMinStr) : boundsMin;
    const urlMax = urlMaxStr ? parseFloat(urlMaxStr) : boundsMax;
    
    // Only validate that values are numbers and min <= max (no clamping to bounds)
    const validMin = isNaN(urlMin) ? boundsMin : urlMin;
    const validMax = isNaN(urlMax) ? boundsMax : urlMax;
    const next: [number, number] = [Math.min(validMin, validMax), Math.max(validMin, validMax)];
    
    // Only update if different (prevents unnecessary updates)
    if (
      Math.abs(uiRange[0] - next[0]) > 0.01 ||
      Math.abs(uiRange[1] - next[1]) > 0.01
    ) {
      setUiRange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPriceBounds?.min, collectionPriceBounds?.max]);

  // Track if we're currently committing (to prevent sync loop)
  const isCommittingRef = useRef(false);
  
  // Sync UI range from URL when URL changes externally (back/forward, shared link)
  // Only sync if URL changed and we're not in the middle of a commit
  const urlKey = safeSearchParams?.toString() ?? "";
  
  useEffect(() => {
    // Skip sync if we just committed (prevents feedback loop)
    if (isCommittingRef.current) {
      isCommittingRef.current = false;
      return;
    }
    
    const urlMinStr = safeSearchParams.get("minPrice") || "";
    const urlMaxStr = safeSearchParams.get("maxPrice") || "";
    const boundsMin = collectionPriceBounds?.min ?? 0;
    const boundsMax = collectionPriceBounds?.max ?? 1000;
    
    // Use URL values directly, or default to bounds if not set
    const urlMin = urlMinStr ? parseFloat(urlMinStr) : boundsMin;
    const urlMax = urlMaxStr ? parseFloat(urlMaxStr) : boundsMax;
    
    // Only validate that values are numbers and min <= max (no clamping to bounds)
    const validMin = isNaN(urlMin) ? boundsMin : urlMin;
    const validMax = isNaN(urlMax) ? boundsMax : urlMax;
    
    const next: [number, number] = [
      Math.min(validMin, validMax),
      Math.max(validMin, validMax),
    ];
    
    // Only update if changed (tolerance for floating point)
    if (
      Math.abs(uiRange[0] - next[0]) > 0.01 ||
      Math.abs(uiRange[1] - next[1]) > 0.01
    ) {
      setUiRange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey, collectionPriceBounds?.min, collectionPriceBounds?.max]);


  return (
    <div className="min-h-screen pt-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-6 pt-8 pb-6 md:pt-20 md:pb-16 relative">
        {/* Header with Filters Button */}
        <div className="mb-4 md:mb-4">
          <div className="mb-4">
            <h1 className="text-2xl md:text-4xl font-bold leading-tight text-black text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Sako's {getTranslatedName(selectedCategory, selectedSubcategory)} Collection
            </h1>
          </div>

          <div className={cn("flex items-center gap-3", lng === 'he' ? 'flex-row-reverse' : 'flex-row')}>
            {/* Desktop Filters Button */}
            <button
              onClick={() => setDesktopFiltersOpen(!desktopFiltersOpen)}
              className="hidden md:inline-flex items-center px-4 py-2 text-sm font-medium text-black bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors duration-200"
            >
              <FunnelIcon className={cn("h-4 w-4", lng === 'he' ? 'ml-2' : 'mr-2')} />
              {t.filters}
              {(() => {
                const [currentMin, currentMax] = uiRange;
                const boundsMin = collectionPriceBounds?.min ?? 0;
                const boundsMax = collectionPriceBounds?.max ?? 1000;
                const hasPriceFilter = currentMin > boundsMin || currentMax < boundsMax;
                const activeFilterCount = selectedColors.length + selectedSizes.length + selectedSubSubCategories.length + (hasPriceFilter ? 1 : 0);
                if (activeFilterCount > 0) {
                  return (
                    <span className={cn("bg-black text-white text-xs rounded-full px-2 py-1", lng === 'he' ? 'mr-2' : 'ml-2')}>
                      {activeFilterCount}
                    </span>
                  );
                }
                return null;
              })()}
            </button>

            {/* Mobile Filters Button */}
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="md:hidden inline-flex items-center px-4 py-2 text-sm font-medium text-black bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors duration-200"
            >
              <FunnelIcon className={cn("h-4 w-4", lng === 'he' ? 'ml-1' : 'mr-1')} />
              {t.filters}
              {(() => {
                const [currentMin, currentMax] = uiRange;
                const boundsMin = collectionPriceBounds?.min ?? 0;
                const boundsMax = collectionPriceBounds?.max ?? 1000;
                const hasPriceFilter = currentMin > boundsMin || currentMax < boundsMax;
                const activeFilterCount = selectedColors.length + selectedSizes.length + selectedSubSubCategories.length + (hasPriceFilter ? 1 : 0);
                if (activeFilterCount > 0) {
                  return (
                    <span className={cn("bg-black text-white text-xs rounded-full px-2 py-1", lng === 'he' ? 'mr-2' : 'ml-2')}>
                      {activeFilterCount}
                    </span>
                  );
                }
                return null;
              })()}
            </button>

            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger 
                className={cn(
                  "w-full sm:w-auto text-black md:py-3 md:px-4 md:text-base md:text-right",
                  lng === 'he' && "md:ml-auto"
                )} 
                dir={lng === 'he' ? 'rtl' : 'ltr'}
              >
                <SelectValue placeholder={t.relevance} />
              </SelectTrigger>
              <SelectContent dir={lng === 'he' ? 'rtl' : 'ltr'} className="md:text-base">
                <SelectItem value="relevance" dir={lng === 'he' ? 'rtl' : 'ltr'} className="md:py-2">{t.relevance}</SelectItem>
                <SelectItem value="price-low" dir={lng === 'he' ? 'rtl' : 'ltr'} className="md:py-2">{t.priceLow}</SelectItem>
                <SelectItem value="price-high" dir={lng === 'he' ? 'rtl' : 'ltr'} className="md:py-2">{t.priceHigh}</SelectItem>
                <SelectItem value="newest" dir={lng === 'he' ? 'rtl' : 'ltr'} className="md:py-2">{t.newest}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search Results Label */}
        {searchQuery && (
          <div className="w-full mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {lng === 'he' 
                    ? `תוצאות עבור: "${searchQuery}"`
                    : `Results for: "${searchQuery}"`
                  }
                </h2>
                {totalProducts !== undefined && (
                  <p className="text-sm text-gray-500 mt-1">
                    {lng === 'he'
                      ? `נמצאו ${totalProducts} תוצאות`
                      : `${totalProducts} result${totalProducts !== 1 ? 's' : ''} found`
                    }
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Showing X of Y counter */}
        {sortedItems.length > 0 && (
          <div className="mb-4 text-sm text-gray-600">
            {lng === 'he' 
              ? `${t.showing} ${useVariantItems ? allVariantItems.length : allProducts.length} ${t.of} ${totalProducts} ${t.items}`
              : `${t.showing} ${useVariantItems ? allVariantItems.length : allProducts.length} ${t.of} ${totalProducts} ${t.items}`
            }
          </div>
        )}

        {/* Products Grid - Full Width */}
        <div className="w-full">
          {sortedItems.length === 0 ? (
            <div className="text-center py-4">
              <CubeIcon className="mx-auto h-14 w-14 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {searchQuery 
                  ? (lng === 'he' ? `לא נמצאו תוצאות עבור "${searchQuery}"` : `No results found for "${searchQuery}"`)
                  : t.noProductsFound
                }
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery
                  ? (lng === 'he' ? 'נסה לשנות את מילות החיפוש או לבדוק את האיות.' : 'Try different search terms or check your spelling.')
                  : t.tryAdjusting
                }
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-2 sm:gap-6 -mx-3 ">
                {useVariantItems
                  ? (sortedItems as VariantItem[]).map((item, index) => {
                      // Calculate if item is above the fold (first 6-8 items)
                      // Mobile: 2 rows = 4 items, Desktop: 1-2 rows = 3-6 items
                      const isAboveFold = index < 6;
                      
                      return (
                        <motion.div
                          key={item.variantKey}
                          {...({ whileHover: { y: -4 } } as unknown as Record<string, unknown>)}
                          transition={{ duration: 0.2 }}
                        >
                          <ProductCard 
                            product={item.product} 
                            language={lng as 'en' | 'he'} 
                            returnUrl={currentUrl}
                            selectedColors={selectedColors.length > 0 ? selectedColors : undefined}
                            preselectedColorSlug={item.variant.colorSlug}
                            isAboveFold={isAboveFold}
                          />
                        </motion.div>
                      );
                    })
                  : (sortedItems as Product[]).map((product, index) => {
                      // Calculate if product is above the fold (first 6-8 products)
                      // Mobile: 2 rows = 4 products, Desktop: 1-2 rows = 3-6 products
                      const isAboveFold = index < 6;
                      
                      return (
                        <motion.div
                          key={product.id}
                          {...({ whileHover: { y: -4 } } as unknown as Record<string, unknown>)}
                          transition={{ duration: 0.2 }}
                        >
                          <ProductCard 
                            product={product} 
                            language={lng as 'en' | 'he'} 
                            returnUrl={currentUrl}
                            selectedColors={selectedColors.length > 0 ? selectedColors : undefined}
                            isAboveFold={isAboveFold}
                          />
                        </motion.div>
                      );
                    })}
              </div>
              
              {/* Load More Button */}
              {hasMore && (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    disabled={isLoadingMore}
                    onClick={(e) => {
                      // Prevent any default behavior that might cause scroll
                      e.preventDefault();
                      e.stopPropagation();
                      handleLoadMore();
                    }}
                    onMouseDown={(e) => {
                      // Prevent focus on mousedown to avoid scroll jumps
                      // This helps prevent browser from scrolling to button
                      if (e.button === 0) {
                        // Just prevent focus, don't prevent the click
                        e.currentTarget.blur();
                      }
                    }}
                    className={cn(
                      "px-6 py-3 bg-[#856D55] text-white font-medium rounded-md transition-colors duration-200",
                      "hover:bg-[#856D55]/90 disabled:opacity-50 disabled:cursor-not-allowed",
                      isLoadingMore && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isLoadingMore ? t.loading : t.loadMore}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Desktop Filter Overlay and Sidebar */}
      <AnimatePresence>
        {desktopFiltersOpen && (
          <>
            {/* Desktop Filter Overlay */}
            <div className="fixed inset-0 z-[68] lg:hidden">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/30"
                onClick={() => setDesktopFiltersOpen(false)}
              />
            </div>
            
            <div className="fixed inset-0 z-[68] hidden lg:block">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/30"
                onClick={() => setDesktopFiltersOpen(false)}
              />
            </div>
            
            {/* Desktop Filter Sidebar */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-80 bg-white shadow-2xl z-[70]"
            >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-lg font-light text-black tracking-wider uppercase">{t.filters}</h2>
            <button
              onClick={() => setDesktopFiltersOpen(false)}
              className="text-black hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <Accordion 
              type="multiple" 
              value={desktopAccordionValue}
              onValueChange={setDesktopAccordionValue}
              className="space-y-6"
            >
              {/* Price Filter */}
              <AccordionItem value="price" className="border border-gray-200 rounded-lg">
                <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                  <h3 className="text-sm font-medium text-black">{t.price}</h3>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4 pt-3 border-t border-gray-100">
                    {/* Price Range Label */}
                    <div className="text-sm font-medium text-gray-900">
                      ₪{uiRange[0].toLocaleString()} - ₪{uiRange[1].toLocaleString()}
                    </div>
                    
                    {/* Price Range Slider */}
                    <div className="px-2">
                      <Slider
                        value={uiRange}
                        onValueChange={handleSliderChange}
                        onValueCommit={handleSliderCommit}
                        min={Math.max(0, Math.floor((collectionPriceBounds.min - 200) / 10) * 10)}
                        max={Math.ceil((collectionPriceBounds.max + 200) / 10) * 10}
                        step={10}
                        className="w-full"
                        dir={lng === 'he' ? 'rtl' : 'ltr'}
                      />
                    </div>

                    {/* Reset Button */}
                    {(uiRange[0] !== collectionPriceBounds.min || uiRange[1] !== collectionPriceBounds.max) && (
                      <button
                        onClick={handlePriceReset}
                        className="text-xs text-gray-600 hover:text-gray-800 underline"
                      >
                        {lng === 'he' ? 'איפוס' : 'Reset'}
                      </button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Colors */}
              <AccordionItem value="colors" className="border border-gray-200 rounded-lg">
                <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                  <h3 className="text-sm font-medium text-black">{t.colors}</h3>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-2 pt-3 border-t border-gray-100">
                    {allColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleColorToggle(color)}
                        className={`w-full flex items-center space-x-3 p-2 rounded-sm transition-all duration-200 ${
                          selectedColors.includes(color)
                            ? 'bg-gray-100 border border-gray-300'
                            : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-full border border-gray-200"
                          style={{ backgroundColor: colorSlugToHex[color] || getColorHex(color) }}
                        />
                        <span className="text-sm font-light text-black">{getColorName(color, lng as 'en' | 'he')}</span>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Sizes */}
              <AccordionItem value="sizes" className="border border-gray-200 rounded-lg">
                <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                  <h3 className="text-sm font-medium text-black">{t.sizes}</h3>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4 pt-3 border-t border-gray-100">
                    {numericSizes.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-600 mb-2">Shoes</h4>
                        <div className="grid grid-cols-4 gap-2">
                          {numericSizes.map((size) => (
                            <button
                              key={size}
                              onClick={() => handleSizeToggle(size)}
                              className={`p-2 rounded-sm transition-all duration-200 text-center ${
                                selectedSizes.includes(size)
                                  ? 'bg-gray-100 border border-gray-300'
                                  : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                              }`}
                            >
                              <span className="text-sm font-light text-black">{size}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {alphaSizes.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-600 mb-2">Clothing</h4>
                        <div className="grid grid-cols-3 gap-2">
                          {alphaSizes.map((size) => (
                            <button
                              key={size}
                              onClick={() => handleSizeToggle(size)}
                              className={`p-2 rounded-sm transition-all duration-200 text-center ${
                                selectedSizes.includes(size)
                                  ? 'bg-gray-100 border border-gray-300'
                                  : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                              }`}
                            >
                              <span className="text-sm font-light text-black">{size}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Sub-Sub Categories */}
              {showSubSubCategoryFilter && Object.keys(subSubCategoriesByParent).length > 0 && (
                <AccordionItem value="subSubCategories" className="border border-gray-200 rounded-lg">
                  <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                    <h3 className="text-sm font-medium text-black">
                      {lng === 'he' ? 'תת-קטגוריות' : 'Sub-Categories'}
                    </h3>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4 pt-3 border-t border-gray-100">
                      {Object.entries(subSubCategoriesByParent).map(([parentId, subSubCats]) => (
                        <div key={parentId} className="space-y-2">
                          <h4 className="text-xs font-medium text-gray-600 mb-2">
                            {getParentCategoryName(parentId)}
                          </h4>
                          <div className="space-y-2">
                            {subSubCats.map((category) => (
                              <button
                                key={category.id}
                                onClick={() => handleSubSubCategoryToggle(category.id!)}
                                className={`w-full flex items-center p-2 rounded-sm transition-all duration-200 ${
                                  selectedSubSubCategories.includes(category.id!)
                                    ? 'bg-gray-100 border border-gray-300'
                                    : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                                }`}
                              >
                                <span className="text-sm font-light text-black">
                                  {getSubSubCategoryName(category)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>

            {/* Clear Filters Button */}
            {(() => {
              const [currentMin, currentMax] = uiRange;
              const boundsMin = collectionPriceBounds?.min ?? 0;
              const boundsMax = collectionPriceBounds?.max ?? 1000;
              const hasPriceFilter = currentMin > boundsMin || currentMax < boundsMax;
              if (selectedColors.length > 0 || selectedSizes.length > 0 || selectedSubSubCategories.length > 0 || hasPriceFilter) {
                return (
                  <div className="mb-6">
                    <button
                      onClick={handleClearFilters}
                      className="w-full py-2 px-4 text-sm font-light text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-200 border border-gray-200 rounded-sm"
                    >
                      {t.clearAllFilters}
                    </button>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          <div className="p-6 border-t border-gray-100">
            <button
              onClick={() => setDesktopFiltersOpen(false)}
              className="w-full py-3 px-4 bg-[#856D55]/90 text-white text-sm font-light tracking-wider uppercase hover:bg-[#856D55] transition-colors duration-200"
            >
              {t.applyFilters}
            </button>
          </div>
        </div>
      </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Filter Overlay */}
      <AnimatePresence>
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-[70] md:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/30"
              onClick={() => setMobileFiltersOpen(false)}
            />
            
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 h-full w-80 bg-white shadow-xl z-[71]"
            >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-lg font-light text-black tracking-wider uppercase">{t.filters}</h2>
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="text-black hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {/* Same filter content as desktop */}
                <Accordion 
                  type="multiple" 
                  value={mobileAccordionValue}
                  onValueChange={setMobileAccordionValue}
                  className="space-y-6"
                >
                  <AccordionItem value="price" className="border border-gray-200 rounded-lg">
                    <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                      <h3 className="text-sm font-medium text-black">{t.price}</h3>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4 pt-3 border-t border-gray-100">
                        {/* Price Range Label */}
                        <div className="text-sm font-medium text-gray-900">
                          ₪{uiRange[0].toLocaleString()} - ₪{uiRange[1].toLocaleString()}
                        </div>
                        
                         {/* Price Range Slider */}
                         <div className="px-2">
                           <Slider
                             value={uiRange}
                             onValueChange={handleSliderChange}
                             onValueCommit={handleSliderCommit}
                             min={Math.max(0, Math.floor((collectionPriceBounds.min - 200) / 10) * 10)}
                             max={Math.ceil((collectionPriceBounds.max + 200) / 10) * 10}
                             step={10}
                             className="w-full"
                             dir={lng === 'he' ? 'rtl' : 'ltr'}
                           />
                         </div>

                        {/* Reset Button */}
                        {(uiRange[0] !== collectionPriceBounds.min || uiRange[1] !== collectionPriceBounds.max) && (
                          <button
                            onClick={handlePriceReset}
                            className="text-xs text-gray-600 hover:text-gray-800 underline"
                          >
                            {lng === 'he' ? 'איפוס' : 'Reset'}
                          </button>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="colors" className="border border-gray-200 rounded-lg">
                    <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                      <h3 className="text-sm font-medium text-black">{t.colors}</h3>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-2 pt-3 border-t border-gray-100">
                        {allColors.map((color) => (
                          <button
                            key={color}
                            onClick={() => handleColorToggle(color)}
                            className={`w-full flex items-center space-x-3 p-2 rounded-sm transition-all duration-200 ${
                              selectedColors.includes(color)
                                ? 'bg-gray-100 border border-gray-300'
                                : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                            }`}
                          >
                            <div
                              className="w-6 h-6 rounded-full border border-gray-200"
                              style={{ backgroundColor: colorSlugToHex[color] || getColorHex(color) }}
                            />
                            <span className="text-sm font-light text-black">{getColorName(color, lng as 'en' | 'he')}</span>
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="sizes" className="border border-gray-200 rounded-lg">
                    <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                      <h3 className="text-sm font-medium text-black">{t.sizes}</h3>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4 pt-3 border-t border-gray-100">
                        {numericSizes.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-600 mb-2">Shoes</h4>
                            <div className="grid grid-cols-4 gap-2">
                              {numericSizes.map((size) => (
                                <button
                                  key={size}
                                  onClick={() => handleSizeToggle(size)}
                                  className={`p-2 rounded-sm transition-all duration-200 text-center ${
                                    selectedSizes.includes(size)
                                      ? 'bg-gray-100 border border-gray-300'
                                      : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                                  }`}
                                >
                                  <span className="text-sm font-light text-black">{size}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {alphaSizes.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-600 mb-2">Clothing</h4>
                            <div className="grid grid-cols-3 gap-2">
                              {alphaSizes.map((size) => (
                                <button
                                  key={size}
                                  onClick={() => handleSizeToggle(size)}
                                  className={`p-2 rounded-sm transition-all duration-200 text-center ${
                                    selectedSizes.includes(size)
                                      ? 'bg-gray-100 border border-gray-300'
                                      : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                                  }`}
                                >
                                  <span className="text-sm font-light text-black">{size}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Sub-Sub Categories - Mobile */}
                  {showSubSubCategoryFilter && Object.keys(subSubCategoriesByParent).length > 0 && (
                    <AccordionItem value="subSubCategories" className="border border-gray-200 rounded-lg">
                      <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                        <h3 className="text-sm font-medium text-black">
                          {lng === 'he' ? 'תת-קטגוריות' : 'Sub-Categories'}
                        </h3>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-4 pt-3 border-t border-gray-100">
                          {Object.entries(subSubCategoriesByParent).map(([parentId, subSubCats]) => (
                            <div key={parentId} className="space-y-2">
                              <h4 className="text-xs font-medium text-gray-600 mb-2">
                                {getParentCategoryName(parentId)}
                              </h4>
                              <div className="space-y-2">
                                {subSubCats.map((category) => (
                                  <button
                                    key={category.id}
                                    onClick={() => handleSubSubCategoryToggle(category.id!)}
                                    className={`w-full flex items-center p-2 rounded-sm transition-all duration-200 ${
                                      selectedSubSubCategories.includes(category.id!)
                                        ? 'bg-gray-100 border border-gray-300'
                                        : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                                    }`}
                                  >
                                    <span className="text-sm font-light text-black">
                                      {getSubSubCategoryName(category)}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>

                {/* Clear Filters Button */}
                {(() => {
                  const [currentMin, currentMax] = uiRange;
                  const boundsMin = collectionPriceBounds?.min ?? 0;
                  const boundsMax = collectionPriceBounds?.max ?? 1000;
                  const hasPriceFilter = currentMin > boundsMin || currentMax < boundsMax;
                  if (selectedColors.length > 0 || selectedSizes.length > 0 || selectedSubSubCategories.length > 0 || hasPriceFilter) {
                    return (
                      <div className="mb-6">
                        <button
                          onClick={handleClearFilters}
                          className="w-full py-2 px-4 text-sm font-light text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-200 border border-gray-200 rounded-sm"
                        >
                          {t.clearAllFilters}
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="p-6 border-t border-gray-100">
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="w-full py-3 px-4 bg-[#856D55]/90 text-white text-sm font-light tracking-wider uppercase hover:bg-[#856D55] transition-colors duration-200"
                >
                  {t.applyFilters}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
        )}
      </AnimatePresence>

      {/* Scroll to Top Button */}
      <ScrollToTopButton lng={lng as 'en' | 'he'} />
    </div>
  );
}

