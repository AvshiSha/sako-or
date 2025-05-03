'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  ChevronDownIcon, 
  FunnelIcon, 
  ArrowsUpDownIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import QuickViewModal from '../components/QuickViewModal'
import { products, Product } from '../data/products'

export default function CollectionPage() {
  const pathname = usePathname()
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState('All Products')
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])
  const [sortBy, setSortBy] = useState('relevance')
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false)

  // Parse URL to get category and subcategory
  useEffect(() => {
    const pathSegments = pathname.split('/').filter(Boolean)
    if (pathSegments.length >= 2) {
      const category = pathSegments[1]
      setSelectedCategory(category)
      
      if (pathSegments.length >= 4) {
        const subcategory = pathSegments[3]
        setSelectedSubcategory(subcategory)
      } else {
        setSelectedSubcategory(null)
      }
    } else {
      setSelectedCategory('All Products')
      setSelectedSubcategory(null)
    }
  }, [pathname])

  const handleCategoryChange = (category: string) => {
    if (category === 'All Products') {
      router.push('/collection')
    } else {
      // Ensure the category is lowercase for consistency
      const formattedCategory = category.toLowerCase()
      router.push(`/collection/${formattedCategory}`)
    }
  }

  const handleSubcategoryChange = (subcategory: string) => {
    if (selectedCategory === 'All Products') return
    const formattedCategory = selectedCategory.toLowerCase()
    router.push(`/collection/${formattedCategory}/shoes/${subcategory}`)
  }

  const filteredProducts = products
    .filter(product => selectedCategory === 'All Products' || product.category === selectedCategory)
    .filter(product => !selectedSubcategory || product.subcategory === selectedSubcategory)
    .filter(product => selectedColors.length === 0 || product.colors.some(color => selectedColors.includes(color)))
    .filter(product => selectedSizes.length === 0 || product.sizes.some(size => selectedSizes.includes(size)))

  // Get unique subcategories for the selected category
  const subcategories = selectedCategory === 'All Products' 
    ? [] 
    : [...new Set(products
        .filter(p => p.category === selectedCategory)
        .map(p => p.subcategory)
        .filter((s): s is string => s !== undefined))]

  const handleQuickView = (product: Product) => {
    setSelectedProduct(product)
    setIsQuickViewOpen(true)
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
            {selectedCategory !== 'All Products' && (
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
                      href={`/collection/${selectedCategory}/shoes/${selectedSubcategory}`}
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
          <div className={`md:w-64 ${showFilters ? 'block' : 'hidden md:block'}`}>
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
                  {['All Products', 'Women', 'Men'].map((category) => (
                    <button
                      key={category}
                      onClick={() => handleCategoryChange(category)}
                      className={`block w-full text-left px-3 py-2 text-sm rounded-md ${
                        selectedCategory.toLowerCase() === category.toLowerCase()
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-500 hover:bg-gray-50'
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
                        onClick={() => handleSubcategoryChange(subcategory)}
                        className={`block w-full text-left px-3 py-2 text-sm rounded-md ${
                          selectedSubcategory === subcategory
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-500 hover:bg-gray-50'
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
                  {['Black', 'Silver', 'Gold', 'Nude', 'Red', 'Tan', 'Navy'].map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setSelectedColors(prev => 
                          prev.includes(color) 
                            ? prev.filter(c => c !== color)
                            : [...prev, color]
                        )
                      }}
                      className={`w-8 h-8 rounded-full border-2 ${
                        selectedColors.includes(color)
                          ? 'border-gray-900'
                          : 'border-gray-200'
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
                  {['36', '37', '38', '39', '40'].map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        setSelectedSizes(prev => 
                          prev.includes(size) 
                            ? prev.filter(s => s !== size)
                            : [...prev, size]
                        )
                      }}
                      className={`w-10 h-10 flex items-center justify-center text-sm rounded-md border ${
                        selectedSizes.includes(size)
                          ? 'border-gray-900 text-gray-900 bg-gray-50'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Sort and Filter Controls */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowFilters(true)}
                  className="md:hidden flex items-center text-gray-500 hover:text-gray-700 bg-gray-50 px-3 py-2 rounded-md border border-gray-200"
                >
                  <FunnelIcon className="h-5 w-5 mr-2" />
                  Filters
                </button>
                <span className="text-sm text-gray-500">
                  {filteredProducts.length} products
                </span>
              </div>
              <div className="flex items-center">
                <label htmlFor="sort" className="text-sm text-gray-500 mr-2">
                  Sort by:
                </label>
                <select
                  id="sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent bg-gray-50 text-gray-700 py-2 px-3"
                >
                  <option value="relevance">Relevance</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="newest">Newest Arrivals</option>
                </select>
              </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="group relative cursor-pointer"
                  onMouseEnter={() => setHoveredProduct(product.id)}
                  onMouseLeave={() => setHoveredProduct(null)}
                  onClick={() => handleQuickView(product)}
                >
                  <div className="aspect-square w-full overflow-hidden rounded-lg bg-gray-50 relative">
                    {product.images[0].endsWith('.svg') ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Image
                          src={product.images[0]}
                          alt={product.name}
                          width={500}
                          height={500}
                          className={`h-full w-full object-contain object-center transition-opacity duration-500 ${
                            hoveredProduct === product.id ? 'opacity-0' : 'opacity-100'
                          }`}
                        />
                      </div>
                    ) : (
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        width={500}
                        height={500}
                        className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500 ${
                          hoveredProduct === product.id ? 'opacity-0' : 'opacity-100'
                        }`}
                      />
                    )}
                    {product.images[1].endsWith('.svg') ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Image
                          src={product.images[1]}
                          alt={product.name}
                          width={500}
                          height={500}
                          className={`h-full w-full object-contain object-center transition-opacity duration-500 ${
                            hoveredProduct === product.id ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                      </div>
                    ) : (
                      <Image
                        src={product.images[1]}
                        alt={product.name}
                        width={500}
                        height={500}
                        className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500 ${
                          hoveredProduct === product.id ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    )}
                  </div>
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-800 tracking-wide uppercase">
                      {product.name}
                    </h3>
                    <p className="mt-1 text-base font-light text-gray-600">
                      ${product.price.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick View Modal */}
      {selectedProduct && (
        <QuickViewModal
          isOpen={isQuickViewOpen}
          onClose={() => setIsQuickViewOpen(false)}
          product={selectedProduct}
        />
      )}
    </div>
  )
} 