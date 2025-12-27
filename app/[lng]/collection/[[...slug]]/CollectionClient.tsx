"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FunnelIcon,
  XMarkIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";
import { Product, Category, productHelpers } from "@/lib/firebase";
import ProductCard from "@/app/components/ProductCard";
import { trackViewItemList } from "@/lib/dataLayer";
import { getColorName, getColorHex } from "@/lib/colors";
import { cn } from "@/lib/utils";
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
    price: "Price",
    minPrice: "Min Price",
    maxPrice: "Max Price",
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
    price: "מחיר",
    minPrice: "מחיר מינימלי",
    maxPrice: "מחיר מקסימלי",
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
  categories: Category[];
  categoryPath: string | undefined;
  selectedCategory: string;
  selectedSubcategory: string | null;
  lng: string;
  searchQuery?: string;
  searchTotal?: number;
  searchPage?: number;
}

export default function CollectionClient({
  initialProducts,
  categories,
  categoryPath,
  selectedCategory,
  selectedSubcategory,
  lng,
  searchQuery,
  searchTotal,
  searchPage = 1,
}: CollectionClientProps) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = translations[lng as keyof typeof translations] || translations.en;

  // Construct current collection URL for return navigation
  const currentUrl = `/${lng}/collection${categoryPath ? `/${categoryPath}` : ''}`;

  // Helper function to get translated category/subcategory name
  const getTranslatedName = (category: string | undefined, subcategory?: string | null) => {
    // If search query exists, show search results title instead
    if (searchQuery) {
      return lng === 'he' ? 'תוצאות חיפוש' : 'Search Results';
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

  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>(() => {
    return {
      min: safeSearchParams.get('minPrice') || '',
      max: safeSearchParams.get('maxPrice') || ''
    };
  });

  const [sortBy, setSortBy] = useState<string>(() => {
    return safeSearchParams.get('sort') || 'relevance';
  });

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);

  // Update URL when filters change
  const updateURL = (newFilters: {
    colors?: string[];
    sizes?: string[];
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
  }) => {
    const urlParams = new URLSearchParams();
    
    if (newFilters.colors && newFilters.colors.length > 0) {
      urlParams.set('colors', newFilters.colors.join(','));
    }
    if (newFilters.sizes && newFilters.sizes.length > 0) {
      urlParams.set('sizes', newFilters.sizes.join(','));
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
    const slug = params?.slug as string[] | undefined;
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
    updateURL({ 
      minPrice: priceRange.min, 
      maxPrice: priceRange.max, 
      colors: newColors, 
      sizes: selectedSizes, 
      sort: sortBy 
    });
  };

  const handleSizeToggle = (size: string) => {
    const newSizes = selectedSizes.includes(size)
      ? selectedSizes.filter((s) => s !== size)
      : [...selectedSizes, size];
    setSelectedSizes(newSizes);
    updateURL({ 
      minPrice: priceRange.min, 
      maxPrice: priceRange.max, 
      colors: selectedColors, 
      sizes: newSizes, 
      sort: sortBy 
    });
  };

  // Debounced price update effect
  useEffect(() => {
    // Always update URL when price values change, even if they're empty (to remove from URL)
    const timeoutId = setTimeout(() => {
      updateURL({ 
        minPrice: priceRange.min, 
        maxPrice: priceRange.max, 
        colors: selectedColors, 
        sizes: selectedSizes, 
        sort: sortBy 
      });
    }, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceRange.min, priceRange.max]);

  const handlePriceChange = (field: 'min' | 'max', value: string) => {
    setPriceRange(prev => ({ ...prev, [field]: value }));
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    updateURL({ 
      minPrice: priceRange.min, 
      maxPrice: priceRange.max, 
      colors: selectedColors, 
      sizes: selectedSizes, 
      sort: newSort 
    });
  };

  const handleClearFilters = () => {
    setSelectedColors([]);
    setSelectedSizes([]);
    setPriceRange({ min: '', max: '' });
    setSortBy('relevance');
    // Use updateURL to ensure all params are properly cleared
    updateURL({ 
      minPrice: '', 
      maxPrice: '', 
      colors: [], 
      sizes: [], 
      sort: 'relevance' 
    });
  };


  // Apply sorting to products (products are already filtered server-side)
  const sortedProducts = useMemo(() => {
    const sorted = [...initialProducts].sort((a, b) => {
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
  }, [initialProducts, sortBy]);

  // Track view_item_list when products are displayed
  useEffect(() => {
    if (sortedProducts.length === 0) return;

    try {
      const listName = categoryPath || selectedCategory || 'All Products';
      const listId = categoryPath || selectedCategory || 'all_products';
      
      const items = sortedProducts.map((product) => {
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
  }, [sortedProducts, categoryPath, selectedCategory, lng]);

  // Build dynamic color mapping from products (includes colorHex when available)
  // This prioritizes colorHex from variants, then falls back to getColorHex
  const colorSlugToHex = useMemo(() => {
    const map: Record<string, string> = {};
    
    // Extract color info from products and add to map
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
    
    return map;
  }, [initialProducts]);

  // Get all colors and sizes from the filtered products
  const allColors = useMemo(() => {
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
  }, [initialProducts]);

  const allSizes = useMemo(() => {
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
  }, [initialProducts]);

  // Separate numeric sizes (shoes) from alpha sizes (clothing)
  const numericSizes = allSizes.filter(size => /^\d+(\.\d+)?$/.test(size)).sort((a, b) => parseFloat(a) - parseFloat(b));
  const alphaSizes = allSizes.filter(size => !/^\d+(\.\d+)?$/.test(size)).sort();

  return (
    <div className="min-h-screen pt-22 bg-white">
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
              {(selectedColors.length > 0 || selectedSizes.length > 0 || priceRange.min || priceRange.max) && (
                <span className={cn("bg-black text-white text-xs rounded-full px-2 py-1", lng === 'he' ? 'mr-2' : 'ml-2')}>
                  {selectedColors.length + selectedSizes.length + (priceRange.min ? 1 : 0) + (priceRange.max ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Mobile Filters Button */}
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="md:hidden inline-flex items-center px-4 py-2 text-sm font-medium text-black bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors duration-200"
            >
              <FunnelIcon className={cn("h-4 w-4", lng === 'he' ? 'ml-1' : 'mr-1')} />
              {t.filters}
              {(selectedColors.length > 0 || selectedSizes.length > 0 || priceRange.min || priceRange.max) && (
                <span className={cn("bg-black text-white text-xs rounded-full px-2 py-1", lng === 'he' ? 'mr-2' : 'ml-2')}>
                  {selectedColors.length + selectedSizes.length + (priceRange.min ? 1 : 0) + (priceRange.max ? 1 : 0)}
                </span>
              )}
            </button>

            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger 
                className="w-full sm:w-auto text-black" 
                dir={lng === 'he' ? 'rtl' : 'ltr'}
              >
                <SelectValue placeholder={t.relevance} />
              </SelectTrigger>
              <SelectContent dir={lng === 'he' ? 'rtl' : 'ltr'}>
                <SelectItem value="relevance" dir={lng === 'he' ? 'rtl' : 'ltr'}>{t.relevance}</SelectItem>
                <SelectItem value="price-low" dir={lng === 'he' ? 'rtl' : 'ltr'}>{t.priceLow}</SelectItem>
                <SelectItem value="price-high" dir={lng === 'he' ? 'rtl' : 'ltr'}>{t.priceHigh}</SelectItem>
                <SelectItem value="newest" dir={lng === 'he' ? 'rtl' : 'ltr'}>{t.newest}</SelectItem>
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
                {searchTotal !== undefined && (
                  <p className="text-sm text-gray-500 mt-1">
                    {lng === 'he'
                      ? `נמצאו ${searchTotal} תוצאות`
                      : `${searchTotal} result${searchTotal !== 1 ? 's' : ''} found`
                    }
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Products Grid - Full Width */}
        <div className="w-full">
          {sortedProducts.length === 0 ? (
            <div className="text-center py-12">
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
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 sm:gap-6">
              {sortedProducts.map((product) => (
                <motion.div
                  key={product.id}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <ProductCard 
                    product={product} 
                    language={lng as 'en' | 'he'} 
                    returnUrl={currentUrl}
                    selectedColors={selectedColors.length > 0 ? selectedColors : undefined}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Filter Overlay and Sidebar */}
      <AnimatePresence>
        {desktopFiltersOpen && (
          <>
            {/* Desktop Filter Overlay */}
            <div className="fixed inset-0 z-40 lg:hidden">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/30"
                onClick={() => setDesktopFiltersOpen(false)}
              />
            </div>
            
            <div className="fixed inset-0 z-40 hidden lg:block">
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
              className="fixed left-0 top-0 h-full w-80 bg-white shadow-2xl z-50"
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
            {/* Price Filter */}
            <Accordion type="single" collapsible className="mb-6 border border-gray-200 rounded-lg">
              <AccordionItem value="price" className="border-0">
                <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                  <h3 className="text-sm font-medium text-black">{t.price}</h3>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {t.minPrice}
                      </label>
                      <input
                        type="number"
                        value={priceRange.min}
                        onChange={(e) => handlePriceChange('min', e.target.value)}
                        placeholder="0"
                        className="w-full px-3 text-gray-600 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {t.maxPrice}
                      </label>
                      <input
                        type="number"
                        value={priceRange.max}
                        onChange={(e) => handlePriceChange('max', e.target.value)}
                        placeholder="10,000"
                        className="w-full px-3 text-gray-600 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Colors */}
            <Accordion type="single" collapsible className="mb-6 border border-gray-200 rounded-lg">
              <AccordionItem value="colors" className="border-0">
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
            </Accordion>

            {/* Sizes */}
            <Accordion type="single" collapsible className="mb-6 border border-gray-200 rounded-lg">
              <AccordionItem value="sizes" className="border-0">
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
            </Accordion>

            {/* Clear Filters Button */}
            {(selectedColors.length > 0 || selectedSizes.length > 0 || priceRange.min || priceRange.max) && (
              <div className="mb-6">
                <button
                  onClick={handleClearFilters}
                  className="w-full py-2 px-4 text-sm font-light text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-200 border border-gray-200 rounded-sm"
                >
                  {t.clearAllFilters}
                </button>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-100">
            <button
              onClick={() => setDesktopFiltersOpen(false)}
              className="w-full py-3 px-4 bg-black text-white text-sm font-light tracking-wider uppercase hover:bg-gray-800 transition-colors duration-200"
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
                <Accordion type="single" collapsible className="mb-6 border border-gray-200 rounded-lg">
                  <AccordionItem value="price" className="border-0">
                    <AccordionTrigger className="p-4 hover:bg-gray-50 hover:no-underline">
                      <h3 className="text-sm font-medium text-black">{t.price}</h3>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-3 pt-3 border-t border-gray-100">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            {t.minPrice}
                          </label>
                          <input
                            type="number"
                            value={priceRange.min}
                            onChange={(e) => handlePriceChange('min', e.target.value)}
                            placeholder="0"
                            className="w-full px-3 text-gray-600 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            {t.maxPrice}
                          </label>
                          <input
                            type="number"
                            value={priceRange.max}
                            onChange={(e) => handlePriceChange('max', e.target.value)}
                            placeholder="10,000"
                            className="w-full px-3 text-gray-600 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <Accordion type="single" collapsible className="mb-6 border border-gray-200 rounded-lg">
                  <AccordionItem value="colors" className="border-0">
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
                </Accordion>

                <Accordion type="single" collapsible className="mb-6 border border-gray-200 rounded-lg">
                  <AccordionItem value="sizes" className="border-0">
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
                </Accordion>

                {(selectedColors.length > 0 || selectedSizes.length > 0 || priceRange.min || priceRange.max) && (
                  <div className="mb-6">
                    <button
                      onClick={handleClearFilters}
                      className="w-full py-2 px-4 text-sm font-light text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-200 border border-gray-200 rounded-sm"
                    >
                      {t.clearAllFilters}
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100">
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="w-full py-3 px-4 bg-black text-white text-sm font-light tracking-wider uppercase hover:bg-gray-800 transition-colors duration-200"
                >
                  {t.applyFilters}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
        )}
      </AnimatePresence>
    </div>
  );
}

