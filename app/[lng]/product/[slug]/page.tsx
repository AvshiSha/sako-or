'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
// import { motion } from 'framer-motion'
import { 
  ChevronLeftIcon, 
  HeartIcon, 
  ShareIcon,
  StarIcon,
  ShoppingBagIcon,
  MinusIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { productService, productHelpers, Product } from '@/lib/firebase'

export default function ProductPage() {
  const params = useParams()
  // const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [selectedColor, setSelectedColor] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isClient, setIsClient] = useState(false)

  // Get language from params
  const lng = params?.lng as string || 'en'
  const slug = params?.slug as string

  // Client-side only effect
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Fetch product data
  useEffect(() => {
    if (!slug || !isClient) return

    const fetchProduct = async () => {
      try {
        setLoading(true)
        const productData = await productService.getProductBySlug(slug, lng as 'en' | 'he')
        setProduct(productData)
        
        // Set default selections
        if (productData) {
          if (productData.sizes && productData.sizes.length > 0) {
            setSelectedSize(productData.sizes[0])
          }
          if (productData.colors && productData.colors.length > 0) {
            setSelectedColor(productData.colors[0])
          }
        }
      } catch (error) {
        console.error('Error fetching product:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [slug, lng, isClient])

  // Show loading until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading product...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
          <p className="text-gray-600 mb-6">The product you&apos;re looking for doesn&apos;t exist.</p>
          <Link 
            href={`/${lng}/collection`}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <ChevronLeftIcon className="h-4 w-4 mr-2" />
            Back to Collection
          </Link>
        </div>
      </div>
    )
  }

  const productName = productHelpers.getField(product, 'name', lng as 'en' | 'he')
  const productDescription = productHelpers.getField(product, 'description', lng as 'en' | 'he')
  // const productSlug = productHelpers.getField(product, 'slug', lng as 'en' | 'he')

  const handleAddToCart = () => {
    // TODO: Implement add to cart functionality
    console.log('Add to cart:', {
      product: productName,
      size: selectedSize,
      color: selectedColor,
      quantity
    })
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: productName,
          text: productDescription,
          url: window.location.href,
        })
      } catch (error) {
        console.log('Error sharing:', error)
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href)
      // TODO: Show toast notification
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb Navigation */}
      <nav className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-2 py-4">
            <Link href={`/${lng}`} className="text-gray-500 hover:text-gray-700">
              {lng === 'he' ? 'בית' : 'Home'}
            </Link>
            <ChevronLeftIcon className="h-4 w-4 text-gray-400 rotate-270" />
            <Link href={`/${lng}/collection`} className="text-gray-500 hover:text-gray-700">
              {lng === 'he' ? 'אוסף' : 'Collection'}
            </Link>
            <ChevronLeftIcon className="h-4 w-4 text-gray-400 rotate-270" />
            <span className="text-gray-900">{productName}</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="aspect-w-1 aspect-h-1 w-full overflow-hidden bg-gray-200 rounded-lg">
              {product.images && product.images.length > 0 ? (
                <Image
                  src={product.images[selectedImageIndex]?.url}
                  alt={productHelpers.getImageAlt(product.images[selectedImageIndex], lng as 'en' | 'he')}
                  width={600}
                  height={600}
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gray-200">
                  <span className="text-gray-400">No image available</span>
                </div>
              )}
            </div>

            {/* Thumbnail Images */}
            {product.images && product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`aspect-w-1 aspect-h-1 w-full overflow-hidden rounded-lg border-2 ${
                      selectedImageIndex === index ? 'border-indigo-600' : 'border-gray-200'
                    }`}
                  >
                    <Image
                      src={image.url}
                      alt={productHelpers.getImageAlt(image, lng as 'en' | 'he')}
                      width={150}
                      height={150}
                      className="h-full w-full object-cover object-center"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            {/* Product Header */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{productName}</h1>
              <div className="mt-2 flex items-center space-x-2">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="h-5 w-5 text-yellow-400" />
                  ))}
                </div>
                <span className="text-sm text-gray-600">(4.8) • 24 reviews</span>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-center space-x-4">
              <span className="text-3xl font-bold text-gray-900">
                ${product.price.toFixed(2)}
              </span>
              {product.salePrice && (
                <>
                  <span className="text-xl text-gray-500 line-through">
                    ${product.salePrice.toFixed(2)}
                  </span>
                  <span className="bg-red-100 text-red-800 text-sm font-medium px-2.5 py-0.5 rounded">
                    Sale
                  </span>
                </>
              )}
            </div>

            {/* Description */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {lng === 'he' ? 'תיאור' : 'Description'}
              </h3>
              <p className="text-gray-600 leading-relaxed">{productDescription}</p>
            </div>

            {/* Size Selection */}
            {product.sizes && product.sizes.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {lng === 'he' ? 'מידה' : 'Size'}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`px-4 py-2 border rounded-md text-sm font-medium ${
                        selectedSize === size
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color Selection */}
            {product.colors && product.colors.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {lng === 'he' ? 'צבע' : 'Color'}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-8 h-8 rounded-full border-2 ${
                        selectedColor === color ? 'border-indigo-600' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color.toLowerCase() }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {lng === 'he' ? 'כמות' : 'Quantity'}
              </h3>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <MinusIcon className="h-4 w-4" />
                </button>
                <span className="text-lg font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-4">
              <button
                onClick={handleAddToCart}
                className="w-full bg-indigo-600 text-white py-3 px-6 rounded-md font-medium hover:bg-indigo-700 transition-colors duration-200 flex items-center justify-center"
              >
                <ShoppingBagIcon className="h-5 w-5 mr-2" />
                {lng === 'he' ? 'הוסף לעגלה' : 'Add to Cart'}
              </button>

              <div className="flex space-x-4">
                <button
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={`flex-1 py-3 px-6 rounded-md font-medium border transition-colors duration-200 flex items-center justify-center ${
                    isFavorite
                      ? 'border-red-300 bg-red-50 text-red-600'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {isFavorite ? (
                    <HeartSolidIcon className="h-5 w-5 mr-2" />
                  ) : (
                    <HeartIcon className="h-5 w-5 mr-2" />
                  )}
                  {lng === 'he' ? 'מועדפים' : 'Favorite'}
                </button>

                <button
                  onClick={handleShare}
                  className="flex-1 py-3 px-6 rounded-md font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center"
                >
                  <ShareIcon className="h-5 w-5 mr-2" />
                  {lng === 'he' ? 'שתף' : 'Share'}
                </button>
              </div>
            </div>

            {/* Product Info */}
            <div className="border-t border-gray-200 pt-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900">
                    {lng === 'he' ? 'מידע נוסף' : 'Additional Information'}
                  </h4>
                  <div className="mt-2 space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>{lng === 'he' ? 'SKU' : 'SKU'}:</span>
                      <span>{product.sku}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{lng === 'he' ? 'קטגוריה' : 'Category'}:</span>
                      <span>{product.category?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{lng === 'he' ? 'מלאי' : 'Stock'}:</span>
                      <span>{product.stock} {lng === 'he' ? 'יחידות' : 'units'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
