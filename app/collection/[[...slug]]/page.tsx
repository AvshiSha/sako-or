"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronDownIcon,
  FunnelIcon,
  ArrowsUpDownIcon,
  XMarkIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";
import QuickViewModal from "../../components/QuickViewModal";
import { productService, Product } from "@/lib/firebase";

export default function CollectionSlugPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string[] | undefined;

  // Determine category and subcategory from slug
  let selectedCategory = "All Products";
  let selectedSubcategory: string | null = null;
  if (slug && slug.length > 0) {
    selectedCategory = slug[0];
    if (slug.length > 1) {
      selectedSubcategory = slug.slice(1).join("/");
    }
  }

  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("relevance");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Real-time fetch
  useEffect(() => {
    setLoading(true);
    const unsubscribe = productService.onProductsChange((productsData) => {
      setProducts(productsData);
      setLoading(false);
    }, { isActive: true });
    return () => unsubscribe();
  }, []);

  // Filtering logic
  const filteredProducts = products
    .filter((product) => {
      // Category filter using categorySlug
      if (selectedCategory === "All Products") return true;
      if (!product.categorySlug) return false;
      if (selectedSubcategory) {
        // Match both category and subcategory slugs
        return (
          product.categorySlug.toLowerCase() === selectedSubcategory.toLowerCase() ||
          product.categorySlug.toLowerCase() === selectedCategory.toLowerCase()
        );
      }
      return product.categorySlug.toLowerCase() === selectedCategory.toLowerCase();
    })
    .filter((product) =>
      selectedColors.length === 0 || product.variants.some((variant) => selectedColors.includes(variant.color || ""))
    )
    .filter((product) =>
      selectedSizes.length === 0 || product.variants.some((variant) => selectedSizes.includes(variant.size || ""))
    );

  // Get unique subcategories for the selected category
  const subcategories = selectedCategory === "All Products"
    ? []
    : [
        ...new Set(
          products
            .filter((p) => p.category?.name?.toLowerCase() === selectedCategory.toLowerCase())
            .map((p) => p.category?.name)
            .filter((s): s is string => s !== undefined)
        ),
      ];

  // Get unique colors and sizes from variants
  const allColors = [
    ...new Set(products.flatMap((p) => p.variants.map((v) => v.color).filter(Boolean))),
  ] as string[];
  const allSizes = [
    ...new Set(products.flatMap((p) => p.variants.map((v) => v.size).filter(Boolean))),
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
                <Link
                  href={`/collection/${selectedCategory}`}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}
                </Link>
                {selectedSubcategory && (
                  <>
                    <ChevronDownIcon className="h-4 w-4 text-gray-400 rotate-270" />
                    <Link
                      href={`/collection/${selectedCategory}/${selectedSubcategory}`}
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
          <div className={`md:w-64 ${showFilters ? "block" : "hidden md:block"}`}>
            <div className="sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-gray-900">Filters</h2>
                <button
                  onClick={() => setShowFilters(false)}
                  className="md:hidden text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Categories */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Categories</h3>
                <div className="space-y-2">
                  {["All Products", "Women", "Men"].map((category) => (
                    <button
                      key={category}
                      onClick={() => router.push(`/collection/${category.toLowerCase()}`)}
                      className={`block w-full text-left px-3 py-2 text-sm rounded-md ${
                        selectedCategory.toLowerCase() === category.toLowerCase()
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subcategories */}
              {subcategories.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Subcategories</h3>
                  <div className="space-y-2">
                    {subcategories.map((subcategory) => (
                      <button
                        key={subcategory}
                        onClick={() => router.push(`/collection/${selectedCategory}/${subcategory}`)}
                        className={`block w-full text-left px-3 py-2 text-sm rounded-md ${
                          selectedSubcategory === subcategory
                            ? "bg-gray-100 text-gray-900"
                            : "text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        {subcategory}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Colors */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Colors</h3>
                <div className="flex flex-wrap gap-2">
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
                      className={`w-8 h-8 rounded-full border-2 ${
                        selectedColors.includes(color)
                          ? "border-gray-900"
                          : "border-gray-200"
                      }`}
                      style={{ backgroundColor: color.toLowerCase() }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Sizes */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Sizes</h3>
                <div className="flex flex-wrap gap-2">
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
                      className={`px-3 py-1 text-sm border rounded-md ${
                        selectedSizes.includes(size)
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
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
                  {selectedCategory === "All Products" ? "All Products" : selectedCategory}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {filteredProducts.length} products
                </p>
              </div>

              <div className="mt-4 sm:mt-0 flex items-center space-x-4">
                {/* Mobile filter button */}
                <button
                  onClick={() => setShowFilters(true)}
                  className="md:hidden inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <FunnelIcon className="h-4 w-4 mr-2" />
                  Filters
                </button>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="block w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="relevance">Relevance</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="newest">Newest</option>
                  <option value="featured">Featured</option>
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
                    onHoverStart={() => setHoveredProduct(product.id || "")}
                    onHoverEnd={() => setHoveredProduct(null)}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="aspect-w-1 aspect-h-1 w-full overflow-hidden rounded-lg bg-gray-200">
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
                      className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100"
                    >
                      <span className="bg-white text-gray-900 px-4 py-2 rounded-md text-sm font-medium">
                        Quick View
                      </span>
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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