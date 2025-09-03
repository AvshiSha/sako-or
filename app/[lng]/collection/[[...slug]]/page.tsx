"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronDownIcon,
  FunnelIcon,
  XMarkIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";
import QuickViewModal from "@/app/components/QuickViewModal";
import { productService, Product, categoryService, Category } from "@/lib/firebase";

export default function CollectionSlugPage() {
  const params = useParams();
  const router = useRouter();
  
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("relevance");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
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
    categoryService.getAllCategories().then(setCategories).catch(console.error);
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
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  const slug = params.slug as string[] | undefined;
  const lng = params.lng as string;

     // Determine category and subcategory from slug
   let selectedCategory = "All Products";
   let selectedSubcategory: string | null = null;
   if (slug && slug.length > 0) {
     selectedCategory = decodeURIComponent(slug[0]);
     if (slug.length > 1) {
       // For nested paths like women/shoes/oxford, we want the last part as subcategory
       if (slug.length === 3 && slug[1] === "shoes") {
         // URL: /en/collection/women/shoes/oxford
         selectedCategory = "women";
         selectedSubcategory = decodeURIComponent(slug[2]);
       } else if (slug.length === 3 && slug[1] === "accessories") {
         // URL: /en/collection/women/accessories/bags
         selectedCategory = "women";
         selectedSubcategory = decodeURIComponent(slug[2]);
       } else if (slug.length === 2) {
         // URL: /en/collection/women/shoes or /en/collection/women/accessories
         selectedSubcategory = decodeURIComponent(slug[1]);
       } else {
         // Fallback for other cases
         selectedSubcategory = decodeURIComponent(slug.slice(1).join("/"));
       }
     }
   }

  // Filtering logic
  const subcategoryObj = categories.find(
    (cat) => cat.slug.toLowerCase() === (selectedSubcategory || '').toLowerCase()
  );
  
  const filteredProducts = products
    .filter((product) => {
      if (selectedSubcategory && subcategoryObj) {
        return product.categoryId === subcategoryObj.id;
      }
      if (selectedCategory === "All Products") return true;
      if (!product.categorySlug) return false;
      return product.categorySlug.toLowerCase() === selectedCategory.toLowerCase();
    })
    .filter((product) => {
      if (selectedColors.length === 0) return true;
      const hasMatchingVariantColor = product.variants?.some((variant) => 
        selectedColors.includes(variant.color || "")
      );
      const hasMatchingColor = product.colors?.some((color) => 
        selectedColors.includes(color)
      );
      return hasMatchingVariantColor || hasMatchingColor;
    })
    .filter((product) => {
      if (selectedSizes.length === 0) return true;
      const hasMatchingVariantSize = product.variants?.some((variant) => 
        selectedSizes.includes(variant.size || "")
      );
      const hasMatchingSize = product.sizes?.some((size) => 
        selectedSizes.includes(size)
      );
      return hasMatchingVariantSize || hasMatchingSize;
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

  const subcategories = [
    "Shoes", "Accessories", "High Heels", "Boots", "Oxford", 
    "Sneakers", "Sandals", "Slippers", "Coats", "Bags"
  ];

  const allColors = [
    ...new Set([
      ...products.flatMap((p) => p.variants?.map((v) => v.color).filter(Boolean) || []),
      ...products.flatMap((p) => p.colors || [])
    ]),
  ] as string[];

  const allSizes = [
    ...new Set([
      ...products.flatMap((p) => p.variants?.map((v) => v.size).filter(Boolean) || []),
      ...products.flatMap((p) => p.sizes || []),
      // Add any additional sizes you want to always show
      "35", "35.5", "36", "36.5", "37", "37.5", "38", "38.5", "39", "39.5", "40", "40.5", "41", "41.5", "42", "42.5", "43", "43.5", "44", "44.5", "45"
    ]),
  ] as string[];

  const handleQuickView = (product: Product) => {
    setSelectedProduct(product);
    setIsQuickViewOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
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
              Home
            </Link>
            <ChevronDownIcon className="h-4 w-4 text-gray-400 rotate-270" />
                         {selectedCategory !== "All Products" && (
               <>
                 {!selectedSubcategory && (
                   <Link
                     href={`/${lng}/collection/${selectedCategory}`}
                     className="text-gray-900"
                   >
                     {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}
                   </Link>
                 )}
                 {selectedSubcategory && (
                   <>
                     <Link
                       href={`/${lng}/collection/${selectedCategory}`}
                       className="text-gray-500 hover:text-gray-700"
                     >
                       {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}
                     </Link>
                     <ChevronDownIcon className="h-4 w-4 text-gray-400 rotate-270" />
                     <Link
                       href={`/${lng}/collection/${selectedCategory}/${selectedSubcategory}`}
                       className="text-gray-900"
                     >
                       {selectedSubcategory.charAt(0).toUpperCase() + selectedSubcategory.slice(1)}
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
              {selectedSubcategory 
                ? selectedSubcategory.charAt(0).toUpperCase() + selectedSubcategory.slice(1)
                : selectedCategory === "All Products" 
                  ? "All Products" 
                  : selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)
              }
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {sortedProducts.length} products
            </p>
          </div>

          <div className="mt-4 sm:mt-0 flex items-center space-x-4">
            {/* Desktop Filters Button */}
            <button
              onClick={() => setDesktopFiltersOpen(!desktopFiltersOpen)}
              className="hidden md:inline-flex items-center px-4 py-2 text-sm font-medium text-black bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors duration-200"
            >
              <FunnelIcon className="h-4 w-4 mr-2" />
              Filters
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
              Filters
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
              <option value="relevance">Relevance</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>

        {/* Products Grid - Full Width */}
        <div className="w-full">
          {sortedProducts.length === 0 ? (
            <div className="text-center py-12">
              <CubeIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Try adjusting your filters or search criteria.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedProducts.map((product) => (
                <motion.div
                  key={product.id}
                  className="group relative"
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="aspect-w-1 aspect-h-1 w-full overflow-hidden bg-gray-200">
                    {product.images && product.images.length > 0 ? (
                      <Image
                        src={product.images.find((img) => img.isPrimary)?.url || product.images[0].url}
                        alt={product.name}
                        width={400}
                        height={400}
                        className="h-full w-full object-cover object-center group-hover:opacity-75"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-gray-200">
                        <CubeIcon className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex justify-between">
                    <div>
                      <h3 className="text-sm text-gray-700">
                        <Link href={`/${lng}/product/${product.slug}`}>
                          <span aria-hidden="true" className="absolute inset-0" />
                          {product.name}
                        </Link>
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">{product.category?.name}</p>
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      ${product.price.toFixed(2)}
                    </p>
                  </div>

                  {/* Quick View Button */}
                  <button
                    onClick={() => handleQuickView(product)}
                    className="absolute inset-0 top-0 h-full w-full bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100"
                    style={{ height: 'calc(100% - 4rem)' }}
                  >
                    {product.images && product.images.length > 1 ? (
                      <Image
                        src={product.images[1].url}
                        alt={`${product.name} - Quick View`}
                        width={400}
                        height={400}
                        className="h-full w-full object-cover object-center"
                      />
                    ) : (
                      <div className="bg-white text-gray-900 px-4 py-2 rounded-md text-sm font-medium">
                        Quick View
                      </div>
                    )}
                  </button>
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
            <h2 className="text-lg font-light text-black tracking-wider uppercase">Filters</h2>
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
                <h3 className="text-sm font-medium text-black">Categories</h3>
                <ChevronDownIcon 
                  className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                    expandedCategories ? 'rotate-180' : ''
                  }`} 
                />
              </button>
              
              {expandedCategories && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="space-y-2 pt-3">
                    {["All Products", "Women", "Men"].map((category) => (
                      <button
                        key={category}
                        onClick={() => {
                          router.push(`/${lng}/collection/${category.toLowerCase()}`);
                          setDesktopFiltersOpen(false);
                        }}
                        className="w-full text-left text-sm font-light text-black hover:text-gray-800 hover:bg-gray-100 hover:border-gray-200 transition-all duration-300 py-2 px-3 rounded-sm border border-transparent"
                      >
                        {category}
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
                <h3 className="text-sm font-medium text-black">Subcategories</h3>
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
                      let targetPath;
                      
                      if (["High Heels", "Boots", "Oxford", "Sneakers", "Sandals", "Slippers"].includes(subcategory)) {
                        targetPath = `/${lng}/collection/women/shoes/${subcategory.toLowerCase().replace(' ', '-')}`;
                      } else if (["Coats", "Bags"].includes(subcategory)) {
                        targetPath = `/${lng}/collection/women/accessories/${subcategory.toLowerCase()}`;
                      } else if (subcategory === "Shoes") {
                        targetPath = `/${lng}/collection/women/shoes`;
                      } else if (subcategory === "Accessories") {
                        targetPath = `/${lng}/collection/women/accessories`;
                      } else {
                        targetPath = `/${lng}/collection/women/${subcategory}`;
                      }
                      
                      return (
                        <button
                          key={subcategory}
                          onClick={() => {
                            router.push(targetPath);
                            setDesktopFiltersOpen(false);
                          }}
                          className="w-full text-left text-sm font-light text-black hover:text-gray-800 hover:bg-gray-100 hover:border-gray-200 transition-all duration-300 py-2 px-3 rounded-sm border border-transparent"
                        >
                          {subcategory}
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
                <h3 className="text-sm font-medium text-black">Colors</h3>
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
                <h3 className="text-sm font-medium text-black">Sizes</h3>
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
                  Clear All Filters
                </button>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-100">
            <button
              onClick={() => setDesktopFiltersOpen(false)}
              className="w-full py-3 px-4 bg-black text-white text-sm font-light tracking-wider uppercase hover:bg-gray-800 transition-colors duration-200"
            >
              Apply Filters
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
                <h2 className="text-lg font-light text-black tracking-wider uppercase">Filters</h2>
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
                    <h3 className="text-sm font-medium text-black">Categories</h3>
                    <ChevronDownIcon 
                      className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                        expandedCategories ? 'rotate-180' : ''
                      }`} 
                    />
                  </button>
                  
                  {expandedCategories && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="space-y-2 pt-3">
                        {["All Products", "Women", "Men"].map((category) => (
                          <button
                            key={category}
                            onClick={() => {
                              router.push(`/${lng}/collection/${category.toLowerCase()}`);
                              setMobileFiltersOpen(false);
                            }}
                            className="w-full text-left text-sm font-light text-black hover:text-gray-800 hover:bg-gray-100 hover:border-gray-200 transition-all duration-300 py-2 px-3 rounded-sm border border-transparent"
                          >
                            {category}
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
                    <h3 className="text-sm font-medium text-black">Subcategories</h3>
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
                          let targetPath;
                          
                          if (["High Heels", "Boots", "Oxford", "Sneakers", "Sandals", "Slippers"].includes(subcategory)) {
                            targetPath = `/${lng}/collection/women/shoes/${subcategory.toLowerCase().replace(' ', '-')}`;
                          } else if (["Coats", "Bags"].includes(subcategory)) {
                            targetPath = `/${lng}/collection/women/accessories/${subcategory.toLowerCase()}`;
                          } else if (subcategory === "Shoes") {
                            targetPath = `/${lng}/collection/women/shoes`;
                          } else if (subcategory === "Accessories") {
                            targetPath = `/${lng}/collection/women/accessories`;
                          } else {
                            targetPath = `/${lng}/collection/women/${subcategory}`;
                          }
                          
                          return (
                            <button
                              key={subcategory}
                              onClick={() => {
                                router.push(targetPath);
                                setMobileFiltersOpen(false);
                              }}
                              className="w-full text-left text-sm font-light text-black hover:text-gray-800 hover:bg-gray-100 hover:border-gray-200 transition-all duration-300 py-2 px-3 rounded-sm border border-transparent"
                            >
                              {subcategory}
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
                    <h3 className="text-sm font-medium text-black">Colors</h3>
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
                    <h3 className="text-sm font-medium text-black">Sizes</h3>
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
                      Clear All Filters
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100">
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="w-full py-3 px-4 bg-black text-white text-sm font-light tracking-wider uppercase hover:bg-gray-800 transition-colors duration-200"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Quick View Modal */}
      {selectedProduct && (
        <QuickViewModal
          product={selectedProduct}
          isOpen={isQuickViewOpen}
          onClose={() => {
            setIsQuickViewOpen(false);
            setSelectedProduct(null);
          }}
        />
      )}
    </div>
  );
}
