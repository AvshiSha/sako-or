'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import Accordion from '@/app/components/Accordion'
import ProductCarousel from '@/app/components/ProductCarousel'

// Mock all products data - replace with your actual data source
const allProducts = [
  {
    id: 1,
    name: 'America\'s Cup Classic',
    price: 299.99,
    category: 'America\'s Cup',
    colors: [
      { name: 'Black', value: 'black', hex: '#000000' },
      { name: 'White', value: 'white', hex: '#FFFFFF' },
      { name: 'Navy', value: 'navy', hex: '#001F3F' }
    ],
    sizes: [7, 8, 9, 10, 11, 12],
    images: [
      '/images/products/americas-cup-1.jpg',
      '/images/products/americas-cup-2.jpg'
    ],
    description: 'The America\'s Cup Classic combines timeless design with modern comfort. Crafted from premium leather with a rubber sole for durability and traction.',
    details: {
      materials: '100% Genuine Leather',
      sole: 'Rubber',
      lining: 'Leather',
      madeIn: 'Italy',
      productCode: 'AC-2024-001'
    }
  },
  {
    id: 2,
    name: 'Downtown Runner',
    price: 349.99,
    category: 'Downtown',
    colors: [
      { name: 'Black', value: 'black', hex: '#000000' },
      { name: 'Gray', value: 'gray', hex: '#808080' },
      { name: 'Blue', value: 'blue', hex: '#0074D9' }
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    images: [
      '/images/products/downtown-1.jpg',
      '/images/products/downtown-2.jpg'
    ],
    description: 'The Downtown Runner combines urban style with athletic performance. Perfect for the modern city dweller.',
    details: {
      materials: '100% Genuine Leather',
      sole: 'Rubber',
      lining: 'Leather',
      madeIn: 'Italy',
      productCode: 'DT-2024-001'
    }
  }
]

export default function ProductPage() {
  const params = useParams()
  const productId = Number(params.slug)
  
  // Find the current product based on the ID
  const currentProduct = allProducts.find(p => p.id === productId) || allProducts[0]
  
  const [selectedColor, setSelectedColor] = useState(currentProduct.colors[0])
  const [selectedSize, setSelectedSize] = useState<number | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isZoomed, setIsZoomed] = useState(false)
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 })
  const [relatedProducts, setRelatedProducts] = useState<any[]>([])

  const lng = params?.lng || 'en'

  useEffect(() => {
    // Reset states when product changes
    setSelectedColor(currentProduct.colors[0])
    setSelectedSize(null)
    setCurrentImageIndex(0)
    setIsZoomed(false)
    setZoomPosition({ x: 0, y: 0 })

    // Update related products
    const getRelatedProducts = () => {
      const sameCategoryProducts = allProducts
        .filter(p => p.category === currentProduct.category && p.id !== currentProduct.id)
        .map(({ id, name, price, category, images }) => ({
          id,
          name,
          price,
          category,
          image: images[0] // Use the first image for the carousel
        }))

      if (sameCategoryProducts.length < 4) {
        const otherCategoryProducts = allProducts
          .filter(p => p.category !== currentProduct.category && p.id !== currentProduct.id)
          .map(({ id, name, price, category, images }) => ({
            id,
            name,
            price,
            category,
            image: images[0]
          }))
          .slice(0, 4 - sameCategoryProducts.length)
        
        return [...sameCategoryProducts, ...otherCategoryProducts]
      }

      return sameCategoryProducts.slice(0, 4)
    }

    setRelatedProducts(getRelatedProducts())
  }, [currentProduct.id])

  const handleImageClick = (index: number) => {
    setCurrentImageIndex(index)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    setZoomPosition({ x, y })
  }

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Left Column - Image Gallery */}
          <div className="lg:w-1/2">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Thumbnail Gallery */}
              <div className="hidden lg:block lg:w-20">
                <div className="flex flex-col gap-2">
                  {currentProduct.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => handleImageClick(index)}
                      className={`relative aspect-square overflow-hidden rounded-md border-2 ${
                        currentImageIndex === index ? 'border-gray-800' : 'border-transparent'
                      }`}
                    >
                      <Image
                        src={image}
                        alt={`${currentProduct.name} - View ${index + 1}`}
                        width={80}
                        height={80}
                        className="object-cover object-center"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Image */}
              <div className="flex-1 relative">
                <div
                  className="relative aspect-square overflow-hidden rounded-lg bg-gray-50"
                  onMouseEnter={() => setIsZoomed(true)}
                  onMouseLeave={() => setIsZoomed(false)}
                  onMouseMove={handleMouseMove}
                >
                  <Image
                    src={currentProduct.images[currentImageIndex]}
                    alt={currentProduct.name}
                    width={800}
                    height={800}
                    className="object-cover object-center"
                  />
                  {isZoomed && (
                    <div
                      className="absolute inset-0 bg-no-repeat bg-[length:200%]"
                      style={{
                        backgroundImage: `url(${currentProduct.images[currentImageIndex]})`,
                        backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`
                      }}
                    />
                  )}
                </div>

                {/* Mobile Image Navigation */}
                <div className="lg:hidden flex justify-between mt-4">
                  <button
                    onClick={() => setCurrentImageIndex(prev => (prev - 1 + currentProduct.images.length) % currentProduct.images.length)}
                    className="p-2 rounded-full bg-white border border-gray-200"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  <div className="flex gap-2">
                    {currentProduct.images.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => handleImageClick(index)}
                        className={`w-2 h-2 rounded-full ${
                          currentImageIndex === index ? 'bg-gray-800' : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentImageIndex(prev => (prev + 1) % currentProduct.images.length)}
                    className="p-2 rounded-full bg-white border border-gray-200"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Product Information */}
          <div className="lg:w-1/2">
            <div className="sticky top-24">
              <h1 className="text-2xl font-medium tracking-wide uppercase mb-2 text-gray-800">
                {currentProduct.name}
              </h1>
              <p className="text-2xl font-light mb-6 text-gray-600">${currentProduct.price.toFixed(2)}</p>

              {/* Color Selection */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-800 mb-3">Color</h3>
                <div className="flex gap-2">
                  {currentProduct.colors.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setSelectedColor(color)}
                      className={`w-8 h-8 rounded-full border-2 ${
                        selectedColor.value === color.value ? 'border-gray-800' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              {/* Size Selection */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-800">Size</h3>
                  <button className="text-sm text-gray-600 hover:text-gray-800">
                    Size Guide
                  </button>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {currentProduct.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(Number(size))}
                      className={`py-2 text-center text-sm rounded-md border ${
                        selectedSize === size
                          ? 'border-gray-800 text-gray-800 bg-gray-50'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add to Cart Button */}
              <button
                className="w-full py-3 px-4 bg-gray-800 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!selectedSize}
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Description & Details */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-200">
        <div className="max-w-3xl mx-auto">
          <Accordion title="Product Details">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-800">Materials</h4>
                  <p className="mt-1 text-sm text-gray-600">{currentProduct.details.materials}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-800">Sole</h4>
                  <p className="mt-1 text-sm text-gray-600">{currentProduct.details.sole}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-800">Lining</h4>
                  <p className="mt-1 text-sm text-gray-600">{currentProduct.details.lining}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-800">Made In</h4>
                  <p className="mt-1 text-sm text-gray-600">{currentProduct.details.madeIn}</p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-800">Product Code</h4>
                <p className="mt-1 text-sm text-gray-600">{currentProduct.details.productCode}</p>
              </div>
            </div>
          </Accordion>

          <Accordion title="Shipping & Returns">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Shipping</h4>
                <p className="mt-1 text-sm text-gray-500">
                  Free standard shipping on all orders. Express shipping available at checkout.
                  Estimated delivery time: 3-5 business days.
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900">Returns</h4>
                <p className="mt-1 text-sm text-gray-500">
                  We accept returns within 30 days of purchase. Items must be unworn and in their original packaging.
                  Please contact our customer service for return instructions.
                </p>
              </div>
            </div>
          </Accordion>

          <Accordion title="Care Instructions">
            <div className="space-y-4">
              <ul className="list-disc list-inside text-sm text-gray-500 space-y-2">
                <li>Clean with a soft, dry cloth</li>
                <li>Store in a cool, dry place away from direct sunlight</li>
                <li>Use a shoe tree to maintain shape</li>
                <li>Avoid exposure to water and extreme temperatures</li>
                <li>Use a leather conditioner periodically to maintain the finish</li>
              </ul>
            </div>
          </Accordion>
        </div>
      </div>

      {/* Related Products */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-200">
        <ProductCarousel
          products={relatedProducts}
          title="You May Also Like"
        />
      </div>
    </div>
  )
} 