"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronDownIcon,
  FunnelIcon,
  XMarkIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";
import { productService, Product, categoryService, Category, productHelpers } from "@/lib/firebase";
import ProductCard from "@/app/components/ProductCard";

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
    categories: "Categories",
    subcategories: "Subcategories",
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
    categories: "קטגוריות",
    subcategories: "תת-קטגוריות",
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

export default function CollectionSlugPage() {
  const params = useParams();
  const router = useRouter();
  
  // Get language from params
  const lng = params?.lng as string || 'en';
  const t = translations[lng as keyof typeof translations] || translations.en;

  // Helper function to get translated category/subcategory name
  const getTranslatedName = (category: string, subcategory?: string | null) => {
    if (subcategory) {
      // For subcategories, try to find a translation
      // Handle different formats: "high-heels" -> "highheels", "High Heels" -> "highheels"
      const subcategoryKey = subcategory.toLowerCase().replace(/[-\s]+/g, '');
      const translatedSubcategory = t.subcategoriesList[subcategoryKey as keyof typeof t.subcategoriesList];
      return translatedSubcategory || subcategory;
    }
    
    // For main categories
    const categoryKey = category.toLowerCase();
    const translatedCategory = t.categoriesList[categoryKey as keyof typeof t.categoriesList];
    return translatedCategory || category;
  };
  
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("relevance");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);
  // Filter section expansion states
  const [expandedCategories, setExpandedCategories] = useState(false);
  const [expandedSubcategories, setExpandedSubcategories] = useState(false);
  const [expandedColors, setExpandedColors] = useState(false);
  const [expandedSizes, setExpandedSizes] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Client-side only effect
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update URL when filters change
  useEffect(() => {
    if (!params || !isClient) return;
    
    const urlParams = new URLSearchParams();
    if (selectedColors.length > 0) {
      urlParams.set('colors', selectedColors.join(','));
    }
    if (selectedSizes.length > 0) {
      urlParams.set('sizes', selectedSizes.join(','));
    }
    
    const queryString = urlParams.toString();
    const lng = params.lng as string;
    const slug = params.slug as string[] | undefined;
    const currentPath = `/${lng}/collection${slug ? '/' + slug.join('/') : ''}`;
    const newUrl = queryString ? `${currentPath}?${queryString}` : currentPath;
    
    // Only update URL if it's different from current
    if (window.location.pathname + window.location.search !== newUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [selectedColors, selectedSizes, params, router, isClient]);
  
  // Initialize filters from URL on mount
  useEffect(() => {
    if (!isClient) return;
    
    const searchParams = new URLSearchParams(window.location.search);
    const colorsParam = searchParams.get('colors');
    const sizesParam = searchParams.get('sizes');
    
    if (colorsParam) {
      setSelectedColors(colorsParam.split(','));
    }
    if (sizesParam) {
      setSelectedSizes(sizesParam.split(','));
    }
  }, [isClient]);

  // Real-time fetch
  useEffect(() => {
    setLoading(true);
    const unsubscribe = productService.onProductsChange((productsData) => {
      setProducts(productsData);
      setLoading(false);
    }, { isActive: true });
    return () => unsubscribe();
  }, []);

  // Fetch categories on mount
  useEffect(() => {
    categoryService.getAllCategories().then(cats => {
      setCategories(cats);
    }).catch(console.error);
  }, []);

  // Add null checking for params after all hooks
  if (!params) {
    return <div>Loading...</div>;
  }
  
  // Show loading until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t.loading}</p>
        </div>
      </div>
    );
  }
  
  const slug = params.slug as string[] | undefined;

     // Determine category and subcategory from slug
   let selectedCategory = "All Products";
   let selectedSubcategory: string | null = null;
   let selectedCategoryPath = "";
   
   if (slug && slug.length > 0) {
     // Build the full category path from the slug
     selectedCategoryPath = slug.map(s => decodeURIComponent(s)).join('/');
     
     
     if (slug.length === 1) {
       // URL: /en/collection/women
       selectedCategory = decodeURIComponent(slug[0]);
     } else if (slug.length === 2) {
       // URL: /en/collection/women/shoes
       selectedCategory = decodeURIComponent(slug[0]);
       selectedSubcategory = decodeURIComponent(slug[1]);
     } else if (slug.length === 3) {
       // URL: /en/collection/women/shoes/boots
       selectedCategory = decodeURIComponent(slug[0]);
       selectedSubcategory = decodeURIComponent(slug[2]); // The deepest category
     } else {
       // For deeper paths, use the full path
       selectedCategory = selectedCategoryPath;
     }
     
   }

  // Filtering logic
  const subcategoryObj = categories.find(
    (cat) => {
      const catSlug = typeof cat.slug === 'string' ? cat.slug : cat.slug?.en || '';
      return catSlug.toLowerCase() === (selectedSubcategory || '').toLowerCase();
    }
  );
  
  const filteredProducts = products
    .filter((product) => {
      // Show all products
      if (selectedCategory === "All Products") return true;
      
      
      // Handle hierarchical category filtering using categoryPath
      if (product.categoryPath && selectedCategoryPath) {
        const requestedPath = selectedCategoryPath.toLowerCase();
        const productPath = product.categoryPath.toLowerCase();
        
        // Exact match: product should appear in its exact category path
        if (productPath === requestedPath) {
          return true;
        }
        
        // Parent match: product should appear in parent category paths
        // e.g., product with path "women/shoes/boots" should appear in "women" and "women/shoes"
        if (productPath.startsWith(requestedPath + '/')) {
          return true;
        }
        
        // Child match: if we're viewing a parent category, show products from child categories
        // e.g., when viewing "women", show products from "women/shoes" and "women/shoes/boots"
        if (requestedPath.startsWith(productPath + '/')) {
          return true;
        }
        
        return false;
      }
      
      // Fallback to old logic for backward compatibility
      if (selectedSubcategory && subcategoryObj) {
        return product.categoryId === subcategoryObj.id;
      }
      
      if (!product.categorySlug) {
        return false;
      }
      return product.categorySlug.toLowerCase() === selectedCategory.toLowerCase();
    })
    .filter((product) => {
      if (selectedColors.length === 0) return true;
      const hasMatchingVariantColor = product.colorVariants?.some((variant) => 
        selectedColors.includes(variant.colorName || "")
      );
      return hasMatchingVariantColor;
    })
    .filter((product) => {
      if (selectedSizes.length === 0) return true;
      const hasMatchingVariantSize = product.colorVariants?.some((variant) => 
        variant.sizes?.some((sizeObj) => selectedSizes.includes(sizeObj.size || ""))
      );
      return hasMatchingVariantSize;
    });

  // Apply sorting to filtered products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case "price-low":
        return a.price - b.price; // Ascending price
      case "price-high":
        return b.price - a.price; // Descending price
      case "newest":
        // Sort by creation date (newest first) - assuming products have a createdAt field
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        // Fallback to id for newer products (assuming higher id = newer)
        const aId = typeof a.id === 'string' ? parseInt(a.id) : (typeof a.id === 'number' ? a.id : 0);
        const bId = typeof b.id === 'string' ? parseInt(b.id) : (typeof b.id === 'number' ? b.id : 0);
        return bId - aId;
      case "relevance":
      default:
        // Relevance sorting - keep original order from database
        return 0;
    }
  });

  // Get subcategories from the fetched categories, filtered by current category
  const subcategories = categories
    .filter(cat => {
      // Only sub-categories (level 1) that belong to the current main category
      if (cat.level !== 1) return false;
      
      // If we're viewing women's collection, only show subcategories under women
      if (selectedCategory.toLowerCase() === 'women') {
        // Find the women category
        const womenCategory = categories.find(c => 
          c.level === 0 && 
          (typeof c.slug === 'string' ? c.slug : c.slug?.en || '').toLowerCase() === 'women'
        );
        return womenCategory && cat.parentId === womenCategory.id;
      }
      
      // If we're viewing men's collection, only show subcategories under men
      if (selectedCategory.toLowerCase() === 'men') {
        // Find the men category
        const menCategory = categories.find(c => 
          c.level === 0 && 
          (typeof c.slug === 'string' ? c.slug : c.slug?.en || '').toLowerCase() === 'men'
        );
        return menCategory && cat.parentId === menCategory.id;
      }
      
      return false;
    })
    .map(cat => ({
      key: typeof cat.slug === 'string' ? cat.slug : cat.slug?.en || '',
      label: typeof cat.name === 'string' ? cat.name : (lng === 'he' ? cat.name?.he : cat.name?.en) || '',
      id: cat.id
    }));

  // Debug logging
  console.log('Selected category:', selectedCategory);
  console.log('Filtered subcategories:', subcategories);

  const allColors = [
    ...new Set([
      ...products.flatMap((p) => p.colorVariants?.map((v) => v.colorName).filter(Boolean) || [])
    ]),
  ] as string[];

  const allSizes = [
    ...new Set([
      ...products.flatMap((p) => p.colorVariants?.flatMap((v) => v.sizes?.map((s) => s.size).filter(Boolean) || []) || []),
      // Add any additional sizes you want to always show
      "35", "35.5", "36", "36.5", "37", "37.5", "38", "38.5", "39", "39.5", "40", "40.5", "41", "41.5", "42", "42.5", "43", "43.5", "44", "44.5", "45"
    ]),
  ] as string[];


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t.loadingProducts}</p>
        </div>
      </div>
    );
  }

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
              {(selectedColors.length > 0 || selectedSizes.length > 0) && (
                <span className="ml-2 bg-black text-white text-xs rounded-full px-2 py-1">
                  {selectedColors.length + selectedSizes.length}
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
              {(selectedColors.length > 0 || selectedSizes.length > 0) && (
                <span className="ml-2 bg-black text-white text-xs rounded-full px-2 py-1">
                  {selectedColors.length + selectedSizes.length}
                </span>
              )}
            </button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
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
                  <ProductCard product={product} language={lng as 'en' | 'he'} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Filter Overlay */}
      {desktopFiltersOpen && (
        <>
          {/* Background overlay for mobile/tablet */}
          <div className="fixed inset-0 z-40 lg:hidden">
            <div 
              className="absolute inset-0 bg-black/30 transition-opacity duration-300 ease-in-out"
              onClick={() => setDesktopFiltersOpen(false)}
            />
          </div>
          
          {/* Background overlay for large screens */}
          <div className="fixed inset-0 z-40 hidden lg:block">
            <div 
              className="absolute inset-0 bg-black/30 transition-opacity duration-300 ease-in-out"
              onClick={() => setDesktopFiltersOpen(false)}
            />
          </div>
        </>
      )}
      
      {/* Desktop Filter Sidebar - All Screen Sizes */}
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
            {/* Categories - Collapsible */}
            <div className="mb-6 border border-gray-200 rounded-lg">
              <button
                onClick={() => setExpandedCategories(!expandedCategories)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors duration-200"
              >
                <h3 className="text-sm font-medium text-black">{t.categories}</h3>
                <ChevronDownIcon 
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                    expandedCategories ? 'rotate-180' : ''
                  }`} 
                />
              </button>
              
              {expandedCategories && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="space-y-2 pt-3">
                    {[
                      { key: "All Products", label: t.allProducts },
                      { key: "Women", label: t.women },
                      { key: "Men", label: t.men }
                    ].map((category) => (
                      <button
                        key={category.key}
                        onClick={() => {
                          router.push(`/${lng}/collection/${category.key.toLowerCase()}`);
                          setDesktopFiltersOpen(false);
                        }}
                        className="w-full text-left text-sm font-light text-black hover:text-gray-800 hover:bg-gray-100 hover:border-gray-200 transition-all duration-300 py-2 px-3 rounded-sm border border-transparent"
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Subcategories - Collapsible */}
            <div className="mb-6 border border-gray-200 rounded-lg">
              <button
                onClick={() => setExpandedSubcategories(!expandedSubcategories)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors duration-200"
              >
                <h3 className="text-sm font-medium text-black">{t.subcategories}</h3>
                <ChevronDownIcon 
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                    expandedSubcategories ? 'rotate-180' : ''
                  }`} 
                />
              </button>
              
              {expandedSubcategories && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="space-y-2 pt-3">
                    {subcategories.map((subcategory) => {
                      // Create dynamic path based on the subcategory slug
                      const targetPath = `/${lng}/collection/women/${subcategory.key}`;
                      
                      return (
                        <button
                          key={subcategory.key}
                          onClick={() => {
                            router.push(targetPath);
                            setDesktopFiltersOpen(false);
                          }}
                          className="w-full text-left text-sm font-light text-black hover:text-gray-800 hover:bg-gray-100 hover:border-gray-200 transition-all duration-300 py-2 px-3 rounded-sm border border-transparent"
                        >
                          {subcategory.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Colors - Collapsible */}
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
                        onClick={() => {
                          setSelectedColors((prev) =>
                            prev.includes(color)
                              ? prev.filter((c) => c !== color)
                              : [...prev, color]
                          );
                        }}
                        className={`w-full flex items-center space-x-3 p-2 rounded-sm transition-all duration-200 ${
                          selectedColors.includes(color)
                            ? 'bg-gray-100 border border-gray-300'
                            : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-full border border-gray-200"
                          style={{ backgroundColor: color.toLowerCase() }}
                        />
                        <span className="text-sm font-light text-black">{color}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sizes - Collapsible */}
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
                  <div className="grid grid-cols-3 gap-2 pt-3">
                    {allSizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          setSelectedSizes((prev) =>
                            prev.includes(size)
                              ? prev.filter((s) => s !== size)
                              : [...prev, size]
                          );
                        }}
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

            {/* Clear Filters Button */}
            {(selectedColors.length > 0 || selectedSizes.length > 0) && (
              <div className="mb-6">
                <button
                  onClick={() => {
                    setSelectedColors([]);
                    setSelectedSizes([]);
                  }}
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
                {/* Mobile filter content - same as desktop but simplified */}
                
                {/* Categories - Collapsible */}
                <div className="mb-6 border border-gray-200 rounded-lg">
                  <button
                    onClick={() => setExpandedCategories(!expandedCategories)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors duration-200"
                  >
                    <h3 className="text-sm font-medium text-black">{t.categories}</h3>
                    <ChevronDownIcon 
                      className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                        expandedCategories ? 'rotate-180' : ''
                      }`} 
                    />
                  </button>
                  
                  {expandedCategories && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="space-y-2 pt-3">
                        {[
                          { key: "All Products", label: t.allProducts },
                          { key: "Women", label: t.women },
                          { key: "Men", label: t.men }
                        ].map((category) => (
                          <button
                            key={category.key}
                            onClick={() => {
                              router.push(`/${lng}/collection/${category.key.toLowerCase()}`);
                              setMobileFiltersOpen(false);
                            }}
                            className="w-full text-left text-sm font-light text-black hover:text-gray-800 hover:bg-gray-100 hover:border-gray-200 transition-all duration-300 py-2 px-3 rounded-sm border border-transparent"
                          >
                            {category.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Subcategories - Collapsible */}
                <div className="mb-6 border border-gray-200 rounded-lg">
                  <button
                    onClick={() => setExpandedSubcategories(!expandedSubcategories)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors duration-200"
                  >
                    <h3 className="text-sm font-medium text-black">{t.subcategories}</h3>
                    <ChevronDownIcon 
                      className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                        expandedSubcategories ? 'rotate-180' : ''
                      }`} 
                    />
                  </button>
                  
                  {expandedSubcategories && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="space-y-2 pt-3">
                        {subcategories.map((subcategory) => {
                          // Create dynamic path based on the subcategory slug
                          const targetPath = `/${lng}/collection/women/${subcategory.key}`;
                          
                          return (
                            <button
                              key={subcategory.key}
                              onClick={() => {
                                router.push(targetPath);
                                setMobileFiltersOpen(false);
                              }}
                              className="w-full text-left text-sm font-light text-black hover:text-gray-800 hover:bg-gray-100 hover:border-gray-200 transition-all duration-300 py-2 px-3 rounded-sm border border-transparent"
                            >
                              {subcategory.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Colors - Collapsible */}
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
                            onClick={() => {
                              setSelectedColors((prev) =>
                                prev.includes(color)
                                  ? prev.filter((c) => c !== color)
                                  : [...prev, color]
                              );
                            }}
                            className={`w-full flex items-center space-x-3 p-2 rounded-sm transition-all duration-200 ${
                              selectedColors.includes(color)
                                ? 'bg-gray-100 border border-gray-300'
                                : 'hover:bg-gray-100 hover:border-gray-200 border border-transparent'
                            }`}
                          >
                            <div
                              className="w-6 h-6 rounded-full border border-gray-200"
                              style={{ backgroundColor: color.toLowerCase() }}
                            />
                            <span className="text-sm font-light text-black">{color}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sizes - Collapsible */}
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
                      <div className="grid grid-cols-3 gap-2 pt-3">
                        {allSizes.map((size) => (
                          <button
                            key={size}
                            onClick={() => {
                              setSelectedSizes((prev) =>
                                prev.includes(size)
                                  ? prev.filter((s) => s !== size)
                                  : [...prev, size]
                              );
                            }}
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

                {/* Clear Filters Button */}
                {(selectedColors.length > 0 || selectedSizes.length > 0) && (
                  <div className="mb-6">
                    <button
                      onClick={() => {
                        setSelectedColors([]);
                        setSelectedSizes([]);
                      }}
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
