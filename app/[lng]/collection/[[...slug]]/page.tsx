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
import QuickViewModal from "../../../components/QuickViewModal";
import { productService, Product, categoryService, Category } from "@/lib/firebase";

export default function CollectionSlugPage() {
  const params = useParams();
  const router = useRouter();
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

     const [selectedColors, setSelectedColors] = useState<string[]>([]);
   const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
   const [sortBy, setSortBy] = useState("relevance");
   const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
   const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
   const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
   const [products, setProducts] = useState<Product[]>([]);
   const [loading, setLoading] = useState(true);
   const [categories, setCategories] = useState<Category[]>([]);

   // Update URL when filters change
   useEffect(() => {
     const params = new URLSearchParams();
     if (selectedColors.length > 0) {
       params.set('colors', selectedColors.join(','));
     }
     if (selectedSizes.length > 0) {
       params.set('sizes', selectedSizes.join(','));
     }
     
     const queryString = params.toString();
     const currentPath = `/${lng}/collection${slug ? '/' + slug.join('/') : ''}`;
     const newUrl = queryString ? `${currentPath}?${queryString}` : currentPath;
     
     // Only update URL if it's different from current
     if (window.location.pathname + window.location.search !== newUrl) {
       router.replace(newUrl, { scroll: false });
     }
   }, [selectedColors, selectedSizes, lng, slug, router]);
   
   // Initialize filters from URL on mount
   useEffect(() => {
     const searchParams = new URLSearchParams(window.location.search);
     const colorsParam = searchParams.get('colors');
     const sizesParam = searchParams.get('sizes');
     
     if (colorsParam) {
       setSelectedColors(colorsParam.split(','));
     }
     if (sizesParam) {
       setSelectedSizes(sizesParam.split(','));
     }
   }, []);

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
            <Link href="/" className="text-gray-500 hover:text-gray-700">
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
        <div className="flex flex-col md:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className="md:w-80">
            <div className="sticky top-24 bg-white h-screen overflow-y-auto">
              <div className="p-8">
                <h2 className="text-lg font-light text-black tracking-wider uppercase mb-8">Filters</h2>

                {/* Categories */}
                <div className="mb-8 pb-6 border-b border-gray-100">
                  <h3 className="text-xs font-light text-black tracking-wider uppercase mb-4">Categories</h3>
                  <div className="space-y-2">
                                         {["All Products", "Women", "Men"].map((category) => (
                       <button
                         key={category}
                         onClick={() => router.push(`/${lng}/collection/${category.toLowerCase()}`)}
                         className="w-full text-left text-sm font-light text-black hover:text-gray-800 hover:bg-gray-100 hover:border-gray-200 transition-all duration-300 py-2 px-3 rounded-sm border border-transparent"
                       >
                         {category}
                       </button>
                     ))}
                  </div>
                </div>

                {/* Subcategories */}
                <div className="mb-8 pb-6 border-b border-gray-100">
                  <h3 className="text-xs font-light text-black tracking-wider uppercase mb-4">Subcategories</h3>
                  <div className="space-y-2">
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
                             onClick={() => router.push(targetPath)}
                             className="w-full text-left text-sm font-light text-black hover:text-gray-800 hover:bg-gray-100 hover:border-gray-200 transition-all duration-300 py-2 px-3 rounded-sm border border-transparent"
                           >
                             {subcategory}
                           </button>
                         );
                    })}
                  </div>
                </div>

                {/* Colors */}
                <div className="mb-8 pb-6 border-b border-gray-100">
                  <h3 className="text-xs font-light text-black tracking-wider uppercase mb-4">Color</h3>
                  <div className="space-y-2">
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

                {/* Sizes */}
                <div className="mb-8">
                  <h3 className="text-xs font-light text-black tracking-wider uppercase mb-4">Size</h3>
                  <div className="space-y-2">
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
                                                 className={`w-full text-left p-2 rounded-sm transition-all duration-200 ${
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
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
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
                 {filteredProducts.length} products
               </p>
             </div>

              <div className="mt-4 sm:mt-0 flex items-center space-x-4">
                <button
                  onClick={() => setMobileFiltersOpen(true)}
                  className="md:hidden inline-flex items-center px-4 py-2 text-sm font-light text-black hover:text-gray-600"
                >
                  <FunnelIcon className="h-4 w-4 mr-2" />
                  Filter
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

            {/* Products */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <CubeIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Try adjusting your filters or search criteria.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map((product) => (
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
                          <Link href={`/product/${product.slug}`}>
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
      </div>

      {/* Mobile Filter Overlay */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
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
                <div className="mb-8">
                  <h3 className="text-xs font-light text-black tracking-wider uppercase mb-4">Categories</h3>
                  <div className="space-y-2">
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

                <div className="mb-8">
                  <h3 className="text-xs font-light text-black tracking-wider uppercase mb-4">Subcategories</h3>
                  <div className="space-y-2">
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
