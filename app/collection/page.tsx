'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  ChevronDownIcon, 
  FunnelIcon, 
  ArrowsUpDownIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import QuickViewModal from '../components/QuickViewModal'

// Mock data - replace with your actual data source
const products = [
  {
    id: 1,
    name: 'America\'s Cup Classic',
    price: 299.99,
    category: 'America\'s Cup',
    colors: ['black', 'white', 'navy'],
    sizes: [7, 8, 9, 10, 11, 12],
    images: [
      '/images/products/americas-cup-1.jpg',
      '/images/products/americas-cup-2.jpg'
    ]
  },
  {
    id: 2,
    name: 'Downtown Runner',
    price: 249.99,
    category: 'Downtown',
    colors: ['gray', 'blue', 'red'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    images: [
      '/images/products/downtown-1.jpg',
      '/images/products/downtown-2.jpg',
      '/images/products/downtown-3.jpg'
    ]
  },
  // Add more products...
]

const categories = [
  'America\'s Cup',
  'Downtown',
  'Prax 01',
  'All Products'
]

const colors = [
  { name: 'Black', value: 'black', hex: '#000000' },
  { name: 'White', value: 'white', hex: '#FFFFFF' },
  { name: 'Navy', value: 'navy', hex: '#001F3F' },
  { name: 'Gray', value: 'gray', hex: '#808080' },
  { name: 'Blue', value: 'blue', hex: '#0074D9' },
  { name: 'Red', value: 'red', hex: '#FF4136' }
]

const sizes = [7, 8, 9, 10, 11, 12]

const sortOptions = [
  { name: 'Relevance', value: 'relevance' },
  { name: 'Price: Low to High', value: 'price-asc' },
  { name: 'Price: High to Low', value: 'price-desc' },
  { name: 'Newest Arrivals', value: 'newest' }
]

export default function CollectionPage() {
  const [selectedCategory, setSelectedCategory] = useState('All Products')
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [selectedSizes, setSelectedSizes] = useState<number[]>([])
  const [sortBy, setSortBy] = useState('relevance')
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [hoveredProduct, setHoveredProduct] = useState<number | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false)

  const filteredProducts = products
    .filter(product => selectedCategory === 'All Products' || product.category === selectedCategory)
    .filter(product => selectedColors.length === 0 || product.colors.some(color => selectedColors.includes(color)))
    .filter(product => selectedSizes.length === 0 || product.sizes.some(size => selectedSizes.includes(size)))

  const toggleColor = (color: string) => {
    setSelectedColors(prev => 
      prev.includes(color) 
        ? prev.filter(c => c !== color)
        : [...prev, color]
    )
  }

  const toggleSize = (size: number) => {
    setSelectedSizes(prev => 
      prev.includes(size) 
        ? prev.filter(s => s !== size)
        : [...prev, size]
    )
  }

  const handleQuickView = (product: any) => {
    setSelectedProduct(product)
    setIsQuickViewOpen(true)
  }

  return (
    <div className="bg-white">
      {/* Breadcrumb Navigation */}
      <nav className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-2 py-4">
            <Link href="/" className="text-gray-500 hover:text-gray-700">
              Home
            </Link>
            <ChevronDownIcon className="h-4 w-4 text-gray-400 rotate-270" />
            <span className="text-gray-900">New Collection</span>
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
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`block w-full text-left px-3 py-2 text-sm rounded-md ${
                        selectedCategory === category
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colors */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Colors</h3>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => toggleColor(color.value)}
                      className={`w-8 h-8 rounded-full border-2 ${
                        selectedColors.includes(color.value)
                          ? 'border-gray-900'
                          : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              {/* Sizes */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Sizes</h3>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => toggleSize(size)}
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

              {/* Filter Button */}
              <button
                onClick={() => setShowFilters(false)}
                className="w-full mt-4 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Apply Filters
              </button>
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
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="group relative"
                >
                  <motion.div
                    onHoverStart={() => setHoveredProduct(product.id)}
                    onHoverEnd={() => setHoveredProduct(null)}
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-lg bg-gray-50 relative">
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        width={500}
                        height={500}
                        className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500 ${
                          hoveredProduct === product.id ? 'opacity-0' : 'opacity-100'
                        }`}
                      />
                      <Image
                        src={product.images[1]}
                        alt={product.name}
                        width={500}
                        height={500}
                        className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500 ${
                          hoveredProduct === product.id ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    </div>
                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-gray-800 tracking-wide uppercase">
                        {product.name}
                      </h3>
                      <p className="mt-1 text-base font-light text-gray-600">
                        ${product.price.toFixed(2)}
                      </p>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-8 flex justify-center">
              <nav className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 rounded-md border border-gray-200 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-3 py-2 text-sm text-gray-500">
                  Page {currentPage}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={filteredProducts.length < 9}
                  className="px-3 py-2 rounded-md border border-gray-200 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-gray-50"
                >
                  Next
                </button>
              </nav>
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