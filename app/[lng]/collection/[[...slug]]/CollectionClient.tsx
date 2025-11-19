"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronDownIcon,
  FunnelIcon,
  XMarkIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";
import { Product, Category, productHelpers } from "@/lib/firebase";
import ProductCard from "@/app/components/ProductCard";
import { trackViewItemList } from "@/lib/dataLayer";
import { getColorName, getColorHex } from "@/lib/colors";

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
}

export default function CollectionClient({
  initialProducts,
  categories,
  categoryPath,
  selectedCategory,
  selectedSubcategory,
  lng,
}: CollectionClientProps) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = translations[lng as keyof typeof translations] || translations.en;

  // Construct current collection URL for return navigation
  const currentUrl = `/${lng}/collection${categoryPath ? `/${categoryPath}` : ''}`;

  // Helper function to get translated category/subcategory name
  const getTranslatedName = (category: string, subcategory?: string | null) => {
    if (subcategory) {
      const subcategoryKey = subcategory.toLowerCase().replace(/[-\s]+/g, '');
      const translatedSubcategory = t.subcategoriesList[subcategoryKey as keyof typeof t.subcategoriesList];
      return translatedSubcategory || subcategory;
    }
    
    const categoryKey = category.toLowerCase();
    const translatedCategory = t.categoriesList[categoryKey as keyof typeof t.categoriesList];
    return translatedCategory || category;
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
  const [expandedPrice, setExpandedPrice] = useState(false);
  const [expandedColors, setExpandedColors] = useState(false);
  const [expandedSizes, setExpandedSizes] = useState(false);

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
    if (newFilters.minPrice) {
      urlParams.set('minPrice', newFilters.minPrice);
    }
    if (newFilters.maxPrice) {
      urlParams.set('maxPrice', newFilters.maxPrice);
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
    updateURL({ ...priceRange, colors: newColors, sizes: selectedSizes, sort: sortBy });
  };

  const handleSizeToggle = (size: string) => {
    const newSizes = selectedSizes.includes(size)
      ? selectedSizes.filter((s) => s !== size)
      : [...selectedSizes, size];
    setSelectedSizes(newSizes);
    updateURL({ ...priceRange, colors: selectedColors, sizes: newSizes, sort: sortBy });
  };

  // Debounced price update effect
  useEffect(() => {
    // Only update URL if price values have actually changed (not on initial mount)
    if (priceRange.min === '' && priceRange.max === '') return;
    
    const timeoutId = setTimeout(() => {
      updateURL({ ...priceRange, colors: selectedColors, sizes: selectedSizes, sort: sortBy });
    }, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceRange.min, priceRange.max]);

  const handlePriceChange = (field: 'min' | 'max', value: string) => {
    setPriceRange(prev => ({ ...prev, [field]: value }));
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    updateURL({ ...priceRange, colors: selectedColors, sizes: selectedSizes, sort: newSort });
  };

  const handleClearFilters = () => {
    setSelectedColors([]);
    setSelectedSizes([]);
    setPriceRange({ min: '', max: '' });
    const slug = params?.slug as string[] | undefined;
    const currentPath = `/${lng}/collection${slug ? '/' + slug.join('/') : ''}`;
    router.push(currentPath, { scroll: false });
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
    <div className="min-h-screen">
      {/* Breadcrumb Navigation */}
      <nav className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-2 py-4">
            <Link href={`/${lng}`} className="text-gray-500 hover:text-gray-700">
              {t.home}
            </Link>
            <ChevronDownIcon className="h-4 w-4 text-gray-400 rotate-270" />
            {selectedCategory !== "All Products" && (
              <>
                {!selectedSubcategory && (
                  <Link
                    href={`/${lng}/collection/${selectedCategory}`}
                    className="text-gray-900"
                  >
                    {getTranslatedName(selectedCategory)}
                  </Link>
                )}
                {selectedSubcategory && (
                  <>
                    <Link
                      href={`/${lng}/collection/${selectedCategory}`}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      {getTranslatedName(selectedCategory)}
                    </Link>
                    <ChevronDownIcon className="h-4 w-4 text-gray-400 rotate-270" />
                    <Link
                      href={`/${lng}/collection/${selectedCategory}/${selectedSubcategory}`}
                      className="text-gray-900"
                    >
                      {getTranslatedName(selectedCategory, selectedSubcategory)}
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Filters Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {getTranslatedName(selectedCategory, selectedSubcategory)}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {sortedProducts.length} {t.products}
            </p>
          </div>

          <div className="mt-4 sm:mt-0 flex items-center space-x-4">
            {/* Desktop Filters Button */}
            <button
              onClick={() => setDesktopFiltersOpen(!desktopFiltersOpen)}
              className="hidden md:inline-flex items-center px-4 py-2 text-sm font-medium text-black bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors duration-200"
            >
              <FunnelIcon className="h-4 w-4 mr-2" />
              {t.filters}
              {(selectedColors.length > 0 || selectedSizes.length > 0 || priceRange.min || priceRange.max) && (
                <span className="ml-2 bg-black text-white text-xs rounded-full px-2 py-1">
                  {selectedColors.length + selectedSizes.length + (priceRange.min ? 1 : 0) + (priceRange.max ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Mobile Filters Button */}
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="md:hidden inline-flex items-center px-4 py-2 text-sm font-medium text-black bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors duration-200"
            >
              <FunnelIcon className="h-4 w-4 mr-2" />
              {t.filters}
              {(selectedColors.length > 0 || selectedSizes.length > 0 || priceRange.min || priceRange.max) && (
                <span className="ml-2 bg-black text-white text-xs rounded-full px-2 py-1">
                  {selectedColors.length + selectedSizes.length + (priceRange.min ? 1 : 0) + (priceRange.max ? 1 : 0)}
                </span>
              )}
            </button>

            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="block w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md text-black bg-white"
            >
              <option value="relevance">{t.relevance}</option>
              <option value="price-low">{t.priceLow}</option>
              <option value="price-high">{t.priceHigh}</option>
              <option value="newest">{t.newest}</option>
            </select>
          </div>
        </div>

        {/* Products Grid - Full Width */}
        <div className="w-full">
          {sortedProducts.length === 0 ? (
            <div className="text-center py-12">
              <CubeIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">{t.noProductsFound}</h3>
              <p className="mt-1 text-sm text-gray-500">
                {t.tryAdjusting}
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
                  <ProductCard product={product} language={lng as 'en' | 'he'} returnUrl={currentUrl} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Filter Overlay */}
      {desktopFiltersOpen && (
        <>
          <div className="fixed inset-0 z-40 lg:hidden">
            <div 
              className="absolute inset-0 bg-black/30 transition-opacity duration-300 ease-in-out"
              onClick={() => setDesktopFiltersOpen(false)}
            />
          </div>
          
          <div className="fixed inset-0 z-40 hidden lg:block">
            <div 
              className="absolute inset-0 bg-black/30 transition-opacity duration-300 ease-in-out"
              onClick={() => setDesktopFiltersOpen(false)}
            />
          </div>
        </>
      )}
      
      {/* Desktop Filter Sidebar */}
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: desktopFiltersOpen ? 0 : '-100%' }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={`fixed left-0 top-0 h-full w-80 bg-white shadow-2xl z-50 ${
          desktopFiltersOpen ? 'block' : 'hidden'
        }`}
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
            <div className="mb-6 border border-gray-200 rounded-lg">
              <button
                onClick={() => setExpandedPrice(!expandedPrice)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors duration-200"
              >
                <h3 className="text-sm font-medium text-black">{t.price}</h3>
                <ChevronDownIcon 
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                    expandedPrice ? 'rotate-180' : ''
                  }`} 
                />
              </button>
              
              {expandedPrice && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="space-y-3 pt-3">
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
                </div>
              )}
            </div>

            {/* Colors */}
            <div className="mb-6 border border-gray-200 rounded-lg">
              <button
                onClick={() => setExpandedColors(!expandedColors)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors duration-200"
              >
                <h3 className="text-sm font-medium text-black">{t.colors}</h3>
                <ChevronDownIcon 
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                    expandedColors ? 'rotate-180' : ''
                  }`} 
                />
              </button>
              
              {expandedColors && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="space-y-2 pt-3">
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
                </div>
              )}
            </div>

            {/* Sizes */}
            <div className="mb-6 border border-gray-200 rounded-lg">
              <button
                onClick={() => setExpandedSizes(!expandedSizes)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors duration-200"
              >
                <h3 className="text-sm font-medium text-black">{t.sizes}</h3>
                <ChevronDownIcon 
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                    expandedSizes ? 'rotate-180' : ''
                  }`} 
                />
              </button>
              
              {expandedSizes && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="space-y-4 pt-3">
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
                </div>
              )}
            </div>

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

      {/* Mobile Filter Overlay */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div 
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileFiltersOpen(false)}
          />
          
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute left-0 top-0 h-full w-80 bg-white shadow-xl"
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
                <div className="mb-6 border border-gray-200 rounded-lg">
                  <button
                    onClick={() => setExpandedPrice(!expandedPrice)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors duration-200"
                  >
                    <h3 className="text-sm font-medium text-black">{t.price}</h3>
                    <ChevronDownIcon 
                      className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                        expandedPrice ? 'rotate-180' : ''
                      }`} 
                    />
                  </button>
                  
                  {expandedPrice && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="space-y-3 pt-3">
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
                    </div>
                  )}
                </div>

                <div className="mb-6 border border-gray-200 rounded-lg">
                  <button
                    onClick={() => setExpandedColors(!expandedColors)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors duration-200"
                  >
                    <h3 className="text-sm font-medium text-black">{t.colors}</h3>
                    <ChevronDownIcon 
                      className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                        expandedColors ? 'rotate-180' : ''
                      }`} 
                    />
                  </button>
                  
                  {expandedColors && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="space-y-2 pt-3">
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
                    </div>
                  )}
                </div>

                <div className="mb-6 border border-gray-200 rounded-lg">
                  <button
                    onClick={() => setExpandedSizes(!expandedSizes)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors duration-200"
                  >
                    <h3 className="text-sm font-medium text-black">{t.sizes}</h3>
                    <ChevronDownIcon 
                      className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                        expandedSizes ? 'rotate-180' : ''
                      }`} 
                    />
                  </button>
                  
                  {expandedSizes && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="space-y-4 pt-3">
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
                    </div>
                  )}
                </div>

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
    </div>
  );
}

