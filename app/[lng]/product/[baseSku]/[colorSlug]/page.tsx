'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import Head from 'next/head'
import { 
  ChevronLeftIcon, 
  HeartIcon, 
  ShareIcon,
  ShoppingBagIcon,
  MinusIcon,
  PlusIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { productService, productHelpers, Product, ColorVariant } from '@/lib/firebase'
import { analytics } from '@/lib/firebase'
import { useFavorites } from '@/app/hooks/useFavorites'
import { useCart } from '@/app/hooks/useCart'
import Toast, { useToast } from '@/app/components/Toast'

interface ProductWithVariants extends Product {
  colorVariants: ColorVariant[]
  defaultColorVariant?: ColorVariant
}

export default function ProductColorPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<ProductWithVariants | null>(null)
  const [currentVariant, setCurrentVariant] = useState<ColorVariant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [isClient, setIsClient] = useState(false)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  
  // Favorites hook
  const { isFavorite, toggleFavorite } = useFavorites()
  
  // Cart hook
  const { addToCart } = useCart()
  
  // Toast hook
  const { toast, showToast, hideToast } = useToast()

  // Get language, baseSku, and colorSlug from params
  const lng = params?.lng as string || 'en'
  const baseSku = params?.baseSku as string
  const colorSlug = params?.colorSlug as string

  // Client-side only effect
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Fetch product data by baseSku and colorSlug
  useEffect(() => {
    if (!baseSku || !colorSlug || !isClient) return

    const fetchProduct = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Get product with all color variants
        const productData = await productService.getProductWithColorVariants(baseSku)
        
        if (!productData) {
          setError('Product not found')
          setLoading(false)
          return
        }

        // Find the specific color variant
        const variant = productData.colorVariants.find(v => v.colorSlug === colorSlug)
        
        if (!variant) {
          setError('Color variant not found')
          setLoading(false)
          return
        }

        setProduct(productData)
        setCurrentVariant(variant)
        
        // Set default size from first available
        if (variant.sizes && variant.sizes.length > 0) {
          setSelectedSize(variant.sizes[0].size)
        }

        // Fire Product View analytics event
        if (analytics && productData && typeof analytics.logEvent === 'function') {
          try {
            analytics.logEvent('view_item', {
              currency: 'USD',
              value: variant.salePrice || variant.price || productData.price,
              items: [{
                item_id: variant.sizes.find(s => s.size === variant.sizes[0]?.size)?.sku || `${baseSku}-${colorSlug}`,
                item_name: `${productHelpers.getField(productData, 'name', lng as 'en' | 'he')} - ${variant.colorName}`,
                item_category: productData.category?.name || 'Unknown',
                price: variant.salePrice || variant.price || productData.price,
                quantity: 1
              }]
            })
          } catch (analyticsError) {
            console.warn('Analytics error:', analyticsError)
          }
        }
      } catch (error) {
        console.error('Error fetching product:', error)
        setError('Failed to load product')
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [baseSku, colorSlug, lng, isClient])

  // Get current price (variant price takes precedence)
  const getCurrentPrice = useCallback(() => {
    if (!currentVariant) return 0
    
    // Check if sale is active
    const now = new Date()
    const isSaleActive = currentVariant.salePrice && 
      (!currentVariant.saleStartDate || now >= currentVariant.saleStartDate) &&
      (!currentVariant.saleEndDate || now <= currentVariant.saleEndDate)
    
    if (isSaleActive) return currentVariant.salePrice!
    if (currentVariant.price) return currentVariant.price
    return product?.price || 0
  }, [currentVariant, product])

  // Get stock for selected size
  const getSizeStock = useCallback((size: string) => {
    if (!currentVariant) return 0
    const sizeData = currentVariant.sizes.find(s => s.size === size)
    return sizeData?.stock || 0
  }, [currentVariant])

  // Reset quantity when size changes
  useEffect(() => {
    if (selectedSize && currentVariant) {
      const sizeStock = getSizeStock(selectedSize)
      if (quantity > sizeStock) {
        setQuantity(Math.max(1, sizeStock))
      }
    }
  }, [selectedSize, currentVariant, quantity, getSizeStock])

  // Handle color change - navigate to new URL
  const handleColorChange = (newColorSlug: string) => {
    console.log('Color change requested:', { newColorSlug, baseSku, lng })
    console.log('Available variants:', product?.colorVariants?.map(v => ({ colorSlug: v.colorSlug, colorName: v.colorName, stock: v.stock })))
    router.push(`/${lng}/product/${baseSku}/${newColorSlug}`)
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

  if (error || !product || !currentVariant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {lng === 'he' ? 'מוצר לא נמצא' : 'Product Not Found'}
          </h1>
          <p className="text-gray-600 mb-6">
            {lng === 'he' 
              ? 'המוצר או הצבע שחיפשת לא קיים או הוסר מהקטלוג.' 
              : 'The product or color you\'re looking for doesn\'t exist or has been removed from the catalog.'
            }
          </p>
          <Link 
            href={`/${lng}/collection`}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <ChevronLeftIcon className={`h-4 w-4 ${lng === 'he' ? 'ml-2' : 'mr-2'}`} />
            {lng === 'he' ? 'חזור לאוסף' : 'Back to Collection'}
          </Link>
        </div>
      </div>
    )
  }

  const productName = productHelpers.getField(product, 'name', lng as 'en' | 'he')
  const productDescription = productHelpers.getField(product, 'description', lng as 'en' | 'he')
  const isRTL = lng === 'he'
  const currentPrice = getCurrentPrice()
  const currentStock = getSizeStock(selectedSize)
  const isOutOfStock = currentStock <= 0

  const handleAddToCart = async () => {
    if (isOutOfStock || isAddingToCart || !selectedSize) return

    setIsAddingToCart(true)

    // Fire Add to Cart analytics event
    if (analytics) {
      try {
        const sizeData = currentVariant.sizes.find(s => s.size === selectedSize)
        analytics.logEvent('add_to_cart', {
          currency: 'USD',
          value: currentPrice * quantity,
          items: [{
            item_id: sizeData?.sku || `${baseSku}-${colorSlug}-${selectedSize}`,
            item_name: `${productName} - ${currentVariant.colorName}`,
            item_category: product.category?.name || 'Unknown',
            item_variant: `${selectedSize}-${currentVariant.colorName}`,
            price: currentPrice,
            quantity: quantity
          }]
        })
      } catch (analyticsError) {
        console.warn('Analytics error:', analyticsError)
      }
    }

    // Add to cart
    const sizeData = currentVariant.sizes.find(s => s.size === selectedSize)
    addToCart({
      sku: sizeData?.sku || `${baseSku}-${colorSlug}-${selectedSize}`,
      name: {
        en: `${product.name?.en || ''} - ${currentVariant.colorName}`,
        he: `${product.name?.he || ''} - ${currentVariant.colorName}`
      },
      price: currentPrice,
      salePrice: currentVariant.salePrice,
      currency: 'USD',
      image: currentVariant.images?.[0]?.url,
      size: selectedSize,
      color: currentVariant.colorName,
      maxStock: currentStock
    })
    
    // Add multiple items if quantity > 1
    for (let i = 1; i < quantity; i++) {
      addToCart({
        sku: sizeData?.sku || `${baseSku}-${colorSlug}-${selectedSize}`,
        name: {
          en: `${product.name?.en || ''} - ${currentVariant.colorName}`,
          he: `${product.name?.he || ''} - ${currentVariant.colorName}`
        },
        price: currentPrice,
        salePrice: currentVariant.salePrice,
        currency: 'USD',
        image: currentVariant.images?.[0]?.url,
        size: selectedSize,
        color: currentVariant.colorName,
        maxStock: currentStock
      })
    }
    
    // Show success toast
    const successMessage = lng === 'he' 
      ? `הוספת ${quantity} ${quantity === 1 ? 'פריט' : 'פריטים'} לעגלה` 
      : `Added ${quantity} ${quantity === 1 ? 'item' : 'items'} to cart`
    showToast(successMessage, 'success')
    
    // Reset button state after a short delay
    setTimeout(() => {
      setIsAddingToCart(false)
    }, 1000)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${productName} - ${currentVariant.colorName}`,
          text: productDescription,
          url: window.location.href,
        })
      } catch (error) {
        console.log('Error sharing:', error)
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href)
      showToast(lng === 'he' ? 'הקישור הועתק' : 'Link copied', 'success')
    }
  }

  // Generate structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": `${productName} - ${currentVariant.colorName}`,
    "description": currentVariant.metaDescription || productDescription,
    "sku": currentVariant.sizes.find(s => s.size === selectedSize)?.sku || `${baseSku}-${colorSlug}`,
    "brand": {
      "@type": "Brand",
      "name": "Sako"
    },
    "offers": {
      "@type": "Offer",
      "price": currentPrice,
      "priceCurrency": "USD",
      "availability": isOutOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      "url": window.location.href
    },
    "image": currentVariant.images?.map(img => img.url) || [],
    "category": product.category?.name,
    "color": currentVariant.colorName
  }

  return (
    <>
      <Head>
        <title>{currentVariant.metaTitle || `${productName} - ${currentVariant.colorName}`} | Sako</title>
        <meta name="description" content={currentVariant.metaDescription || productDescription} />
        <meta name="keywords" content={`${productName}, ${currentVariant.colorName}, ${product.category?.name ? (typeof product.category.name === 'object' ? product.category.name.en : product.category.name) : ''}, shoes, footwear, ${baseSku}`} />
        
        {/* Canonical URL */}
        <link rel="canonical" href={`https://sako-or.com/${lng}/product/${baseSku}/${colorSlug}`} />
        
        {/* Hreflang for language alternatives */}
        <link rel="alternate" hrefLang="en" href={`https://sako-or.com/en/product/${baseSku}/${colorSlug}`} />
        <link rel="alternate" hrefLang="he" href={`https://sako-or.com/he/product/${baseSku}/${colorSlug}`} />
        <link rel="alternate" hrefLang="x-default" href={`https://sako-or.com/en/product/${baseSku}/${colorSlug}`} />
        
        {/* Open Graph */}
        <meta property="og:title" content={`${productName} - ${currentVariant.colorName}`} />
        <meta property="og:description" content={currentVariant.metaDescription || productDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://sako-or.com/${lng}/product/${baseSku}/${colorSlug}`} />
        <meta property="og:image" content={currentVariant.images?.[0]?.url} />
        <meta property="og:site_name" content="Sako" />
        <meta property="product:price:amount" content={currentPrice.toString()} />
        <meta property="product:price:currency" content="USD" />
        <meta property="product:availability" content={isOutOfStock ? "out of stock" : "in stock"} />
        <meta property="product:condition" content="new" />
        <meta property="product:brand" content="Sako" />
        <meta property="product:color" content={currentVariant.colorName} />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${productName} - ${currentVariant.colorName}`} />
        <meta name="twitter:description" content={currentVariant.metaDescription || productDescription} />
        <meta name="twitter:image" content={currentVariant.images?.[0]?.url} />
      </Head>

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className={`min-h-screen bg-white ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Breadcrumb Navigation */}
        <div className="pt-16 bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="py-6" aria-label="Breadcrumb">
              <ol className={`flex items-center space-x-1 text-sm ${isRTL ? 'space-x-reverse' : ''}`}>
                <li>
                  <Link 
                    href={`/${lng}`} 
                    className="text-gray-500 hover:text-gray-700 transition-colors duration-200 font-medium"
                  >
                    {lng === 'he' ? 'בית' : 'Home'}
                  </Link>
                </li>
                <li>
                  <div className="flex items-center">
                    <ChevronLeftIcon className={`h-4 w-4 text-gray-300 mx-2 ${isRTL ? 'rotate-90' : 'rotate-270'}`} />
                  </div>
                </li>
                <li>
                  <Link 
                    href={`/${lng}/collection`} 
                    className="text-gray-500 hover:text-gray-700 transition-colors duration-200 font-medium"
                  >
                    {lng === 'he' ? 'קולקציה' : 'Collection'}
                  </Link>
                </li>
                <li>
                  <div className="flex items-center">
                    <ChevronLeftIcon className={`h-4 w-4 text-gray-300 mx-2 ${isRTL ? 'rotate-90' : 'rotate-270'}`} />
                  </div>
                </li>
                <li>
                  <span className="text-gray-900 font-medium">{productName}</span>
                </li>
                <li>
                  <div className="flex items-center">
                    <ChevronLeftIcon className={`h-4 w-4 text-gray-300 mx-2 ${isRTL ? 'rotate-90' : 'rotate-270'}`} />
                  </div>
                </li>
                <li>
                  <span className="text-gray-600 font-medium">{currentVariant.colorName}</span>
                </li>
              </ol>
            </nav>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Product Images */}
            <div className="space-y-4">
              {/* Main Image */}
              <div className="aspect-w-1 aspect-h-1 w-full overflow-hidden bg-gray-200 rounded-lg">
                {currentVariant.images && currentVariant.images.length > 0 ? (
                  <Image
                    src={currentVariant.images[selectedImageIndex]?.url}
                    alt={currentVariant.images[selectedImageIndex]?.alt || `${productName} - ${currentVariant.colorName}`}
                    width={600}
                    height={600}
                    className="h-full w-full object-cover object-center"
                    priority
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gray-200">
                    <span className="text-gray-400">
                      {lng === 'he' ? 'אין תמונה זמינה' : 'No image available'}
                    </span>
                  </div>
                )}
              </div>

              {/* Thumbnail Images */}
              {currentVariant.images && currentVariant.images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {currentVariant.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`aspect-w-1 aspect-h-1 w-full overflow-hidden rounded-lg border-2 ${
                        selectedImageIndex === index ? 'border-indigo-600' : 'border-gray-200'
                      }`}
                    >
                      <Image
                        src={image.url}
                        alt={image.alt || `${productName} - ${currentVariant.colorName}`}
                        width={150}
                        height={150}
                        className="h-full w-full object-cover object-center"
                        loading="lazy"
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
                <h1 className="text-3xl font-bold text-gray-900">
                  {productName}
                </h1>
              </div>

              {/* Price */}
              <div className="flex items-center space-x-4">
                <span className="text-3xl font-bold text-gray-900">
                  ₪{currentPrice.toFixed(2)}
                </span>
                {currentVariant.salePrice && currentPrice === currentVariant.salePrice && (
                  <>
                    <span className="text-xl text-gray-500 line-through">
                      ₪{(currentVariant.price || product.price).toFixed(2)}
                    </span>
                    <span className="bg-red-100 text-red-800 text-sm font-medium px-2.5 py-0.5 rounded">
                      {lng === 'he' ? 'מבצע' : 'Sale'}
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

              {/* Color Selection */}
              {product.colorVariants && product.colorVariants.length > 1 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {lng === 'he' ? 'צבע' : 'Color'}
                  </h3>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {product.colorVariants.map((variant) => {
                      const isCurrentVariant = variant.colorSlug === colorSlug
                      // Check if variant has any available sizes (stock > 0)
                      const isVariantOutOfStock = !variant.sizes || variant.sizes.length === 0 || variant.sizes.every(size => size.stock <= 0)
                      const variantImage = variant.images?.find(img => img.isPrimary) || variant.images?.[0]
                      
                      return (
                        <button
                          key={variant.colorSlug}
                          onClick={() => {
                            console.log('Color button clicked:', { 
                              colorSlug: variant.colorSlug, 
                              colorName: variant.colorName, 
                              isVariantOutOfStock,
                              currentColorSlug: colorSlug,
                              variantStock: variant.stock,
                              sizes: variant.sizes?.map(s => ({ size: s.size, stock: s.stock }))
                            })
                            if (!isVariantOutOfStock) {
                              handleColorChange(variant.colorSlug)
                            }
                          }}
                          disabled={isVariantOutOfStock}
                          className="flex-shrink-0 relative group"
                          title={variant.colorName}
                        >
                          {/* Product image */}
                          {variantImage ? (
                            <div className={`w-12 h-12 rounded-full overflow-hidden border-2 border-transparent ${
                              isVariantOutOfStock ? 'opacity-50' : ''
                            }`}>
                              <Image
                                src={variantImage.url}
                                alt={variant.colorName}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className={`w-12 h-12 rounded-full border-2 border-gray-200 flex items-center justify-center ${
                              isVariantOutOfStock ? 'opacity-50' : ''
                            }`}>
                              <span className="text-xs text-gray-500">{variant.colorName}</span>
                            </div>
                          )}
                          
                          {/* Selection line indicator */}
                          <div 
                            className={`absolute -bottom-1 left-0 w-12 h-0.5 transition-all duration-200 ${
                              isCurrentVariant 
                                ? 'bg-black' 
                                : 'bg-transparent group-hover:bg-gray-400'
                            }`}
                          />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Size Selection */}
              {currentVariant.sizes && currentVariant.sizes.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {lng === 'he' ? 'מידה' : 'Size'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {currentVariant.sizes
                      .filter(sizeData => sizeData.stock > 0) // Only show available sizes
                      .map((sizeData) => {
                        return (
                          <button
                            key={sizeData.size}
                            onClick={() => setSelectedSize(sizeData.size)}
                            className={`px-4 py-2 border rounded-md text-sm font-medium ${
                              selectedSize === sizeData.size
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                                : 'border-gray-300 text-gray-700 hover:border-gray-400'
                            }`}
                          >
                            {sizeData.size}
                          </button>
                        )
                      })}
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
                    disabled={quantity <= 1 || isOutOfStock}
                    className="p-2 border border-gray-600 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MinusIcon className="h-4 w-4 text-gray-600" />
                  </button>
                  <span className="text-lg font-medium min-w-[2rem] text-center text-gray-600">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(quantity + 1, currentStock))}
                    disabled={quantity >= currentStock || isOutOfStock}
                    className="p-2 border border-gray-600 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PlusIcon className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
                {/* Stock Info */}
                {selectedSize && currentStock > 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    {lng === 'he' 
                      ? `מקסימום ${currentStock} יחידות זמינות` 
                      : `Maximum ${currentStock} units available`
                    }
                  </div>
                )}
                {!selectedSize && currentVariant.sizes && currentVariant.sizes.length > 0 && (
                  <div className="mt-2 text-sm text-gray-500">
                    {lng === 'he' 
                      ? 'אנא בחר מידה' 
                      : 'Please select a size'
                    }
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-4">
                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock || (currentVariant.sizes && currentVariant.sizes.length > 0 && !selectedSize) || isAddingToCart}
                  className={`w-full py-3 px-6 rounded-md font-medium transition-colors duration-200 flex items-center justify-center ${
                    isOutOfStock || (currentVariant.sizes && currentVariant.sizes.length > 0 && !selectedSize) || isAddingToCart
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  <ShoppingBagIcon className="h-5 w-5 mr-2" />
                  {(() => {
                    if (isAddingToCart) {
                      return lng === 'he' ? 'מוסיף לעגלה...' : 'Adding to Cart...'
                    } else if (isOutOfStock) {
                      return lng === 'he' ? 'אזל מהמלאי' : 'Out of Stock'
                    } else if (currentVariant.sizes && currentVariant.sizes.length > 0 && !selectedSize) {
                      return lng === 'he' ? 'בחר מידה' : 'Select Size'
                    } else {
                      return lng === 'he' ? 'הוסף לעגלה' : 'Add to Cart'
                    }
                  })()}
                </button>

                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      const sizeData = currentVariant.sizes.find(s => s.size === selectedSize)
                      const sku = sizeData?.sku || `${baseSku}-${colorSlug}-${selectedSize}`
                      toggleFavorite(sku)
                    }}
                    className={`flex-1 py-3 px-6 rounded-md font-medium border transition-colors duration-200 flex items-center justify-center ${
                      (() => {
                        const sizeData = currentVariant.sizes.find(s => s.size === selectedSize)
                        const sku = sizeData?.sku || `${baseSku}-${colorSlug}-${selectedSize}`
                        return isFavorite(sku)
                      })()
                        ? 'border-red-300 bg-red-50 text-red-600'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {(() => {
                      const sizeData = currentVariant.sizes.find(s => s.size === selectedSize)
                      const sku = sizeData?.sku || `${baseSku}-${colorSlug}-${selectedSize}`
                      return isFavorite(sku)
                    })() ? (
                      <HeartSolidIcon className="h-5 w-5 mr-2" />
                    ) : (
                      <HeartIcon className="h-5 w-5 mr-2" />
                    )}
                    {(() => {
                      const sizeData = currentVariant.sizes.find(s => s.size === selectedSize)
                      const sku = sizeData?.sku || `${baseSku}-${colorSlug}-${selectedSize}`
                      return isFavorite(sku)
                    })()
                      ? (lng === 'he' ? 'הוסר מהמועדפים' : 'Remove from Favorites')
                      : (lng === 'he' ? 'הוסף למועדפים' : 'Add to Favorites')
                    }
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
                        <span>SKU:</span>
                        <span>{baseSku}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{lng === 'he' ? 'צבע' : 'Color'}:</span>
                        <span>{currentVariant.colorName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{lng === 'he' ? 'קטגוריה' : 'Category'}:</span>
                        <span>{typeof product.category?.name === 'object' ? (lng === 'he' ? product.category.name.he : product.category.name.en) : product.category?.name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Toast Notification */}
      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={hideToast}
        type={toast.type}
      />
    </>
  )
}
