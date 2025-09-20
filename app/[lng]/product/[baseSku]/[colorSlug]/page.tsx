'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import Accordion from '@/app/components/Accordion'

interface ProductWithVariants extends Product {
  colorVariants: Record<string, {
    colorSlug: string;
    priceOverride?: number;
    salePrice?: number;
    stockBySize: Record<string, number>;
    metaTitle?: string;
    metaDescription?: string;
    images: string[];
    primaryImage?: string;
    videos?: string[];
  }>
  defaultColorVariant?: {
    colorSlug: string;
    priceOverride?: number;
    salePrice?: number;
    stockBySize: Record<string, number>;
    metaTitle?: string;
    metaDescription?: string;
    images: string[];
    primaryImage?: string;
    videos?: string[];
  }
}

export default function ProductColorPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<ProductWithVariants | null>(null)
  const [currentVariant, setCurrentVariant] = useState<{
    colorSlug: string;
    priceOverride?: number;
    salePrice?: number;
    stockBySize: Record<string, number>;
    metaTitle?: string;
    metaDescription?: string;
    images: string[];
    primaryImage?: string;
    videos?: string[];
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [isClient, setIsClient] = useState(false)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  
  // Image navigation state
  const [isTransitioning, setIsTransitioning] = useState(false)
  
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
        const productData = await productService.getProductByBaseSku(baseSku)
        
        if (!productData) {
          setError('Product not found')
          setLoading(false)
          return
        }

        // Find the specific color variant
        const variant = Object.values(productData.colorVariants).find(v => v.colorSlug === colorSlug)
        
        if (!variant) {
          setError('Color variant not found')
          setLoading(false)
          return
        }

        setProduct(productData)
        setCurrentVariant(variant)
        
        // Debug: Log product structure to help identify data format
        console.log('🔍 Product data structure:', {
          hasMaterialCare: !!productData.materialCare,
          materialCareKeys: productData.materialCare ? Object.keys(productData.materialCare) : [],
          hasLegacyFields: {
            upperMaterial: !!productData.upperMaterial,
            materialInnerSole: !!productData.materialInnerSole,
            lining: !!productData.lining,
            sole: !!productData.sole,
            heelHeight: !!productData.heelHeight
          }
        })
        
        // Set default size from first available
        const availableSizes = Object.keys(variant.stockBySize).filter(size => variant.stockBySize[size] > 0)
        if (availableSizes.length > 0) {
          setSelectedSize(availableSizes[0])
        }

        // Reset image selection to 0 (video will be shown if available)
        setSelectedImageIndex(0)

        // Fire Product View analytics event
        if (analytics && productData && typeof analytics.logEvent === 'function') {
          try {
            analytics.logEvent('view_item', {
              currency: 'USD',
              value: variant.salePrice || productData.price,
              items: [{
                item_id: `${baseSku}-${colorSlug}`,
                item_name: `${productHelpers.getField(productData, 'name', lng as 'en' | 'he')} - ${variant.colorSlug}`,
                item_category: productData.category || 'Unknown',
                price: variant.salePrice || productData.price,
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
    if (currentVariant.salePrice) return currentVariant.salePrice
    return product?.price || 0
  }, [currentVariant, product])

  // Get stock for selected size
  const getSizeStock = useCallback((size: string) => {
    if (!currentVariant) return 0
    return currentVariant.stockBySize[size] || 0
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
    console.log('Available variants:', product?.colorVariants ? Object.values(product.colorVariants).map(v => ({ colorSlug: v.colorSlug, stock: Object.values(v.stockBySize).reduce((sum, stock) => sum + stock, 0) })) : [])
    router.push(`/${lng}/product/${baseSku}/${newColorSlug}`)
  }

  // Get total media count for navigation
  const getTotalMediaCount = useCallback(() => {
    if (!currentVariant) return 0
    const imageCount = currentVariant.images?.length || 0
    const videoCount = currentVariant.videos?.length || 0
    return imageCount + videoCount
  }, [currentVariant])

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
        const sku = `${baseSku}-${colorSlug}-${selectedSize}`
        analytics.logEvent('add_to_cart', {
          currency: 'USD',
          value: currentPrice * quantity,
          items: [{
            item_id: sku,
            item_name: `${productName} - ${currentVariant.colorSlug}`,
            item_category: product.category || 'Unknown',
            item_variant: `${selectedSize}-${currentVariant.colorSlug}`,
            price: currentPrice,
            quantity: quantity
          }]
        })
      } catch (analyticsError) {
        console.warn('Analytics error:', analyticsError)
      }
    }

    // Add to cart
    const sku = `${baseSku}-${colorSlug}-${selectedSize}`
    addToCart({
      sku: sku,
      name: {
        en: `${product.title_en || ''} - ${currentVariant.colorSlug}`,
        he: `${product.title_he || ''} - ${currentVariant.colorSlug}`
      },
      price: currentPrice,
      salePrice: currentVariant.salePrice,
      currency: 'USD',
      image: currentVariant.images?.[0],
      size: selectedSize,
      color: currentVariant.colorSlug,
      maxStock: currentStock
    })
    
    // Add multiple items if quantity > 1
    for (let i = 1; i < quantity; i++) {
      addToCart({
        sku: sku,
        name: {
          en: `${product.title_en || ''} - ${currentVariant.colorSlug}`,
          he: `${product.title_he || ''} - ${currentVariant.colorSlug}`
        },
        price: currentPrice,
        salePrice: currentVariant.salePrice,
        currency: 'USD',
        image: currentVariant.images?.[0],
        size: selectedSize,
        color: currentVariant.colorSlug,
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
          title: `${productName} - ${currentVariant.colorSlug}`,
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
    "name": `${productName} - ${currentVariant.colorSlug}`,
    "description": currentVariant.metaDescription || productDescription,
    "sku": `${baseSku}-${colorSlug}`,
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
    "image": currentVariant.images || [],
    "category": product.category,
    "color": currentVariant.colorSlug
  }

  return (
    <>
      <Head>
        <title>{currentVariant.metaTitle || `${productName} - ${currentVariant.colorSlug}`} | Sako</title>
        <meta name="description" content={currentVariant.metaDescription || productDescription} />
        <meta name="keywords" content={`${productName}, ${currentVariant.colorSlug}, ${product.category || ''}, shoes, footwear, ${baseSku}`} />
        
        {/* Canonical URL */}
        <link rel="canonical" href={`https://sako-or.com/${lng}/product/${baseSku}/${colorSlug}`} />
        
        {/* Hreflang for language alternatives */}
        <link rel="alternate" hrefLang="en" href={`https://sako-or.com/en/product/${baseSku}/${colorSlug}`} />
        <link rel="alternate" hrefLang="he" href={`https://sako-or.com/he/product/${baseSku}/${colorSlug}`} />
        <link rel="alternate" hrefLang="x-default" href={`https://sako-or.com/en/product/${baseSku}/${colorSlug}`} />
        
        {/* Open Graph */}
        <meta property="og:title" content={`${productName} - ${currentVariant.colorSlug}`} />
        <meta property="og:description" content={currentVariant.metaDescription || productDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://sako-or.com/${lng}/product/${baseSku}/${colorSlug}`} />
        <meta property="og:image" content={currentVariant.images?.[0]} />
        <meta property="og:site_name" content="Sako" />
        <meta property="product:price:amount" content={currentPrice.toString()} />
        <meta property="product:price:currency" content="USD" />
        <meta property="product:availability" content={isOutOfStock ? "out of stock" : "in stock"} />
        <meta property="product:condition" content="new" />
        <meta property="product:brand" content="Sako" />
        <meta property="product:color" content={currentVariant.colorSlug} />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${productName} - ${currentVariant.colorSlug}`} />
        <meta name="twitter:description" content={currentVariant.metaDescription || productDescription} />
        <meta name="twitter:image" content={currentVariant.images?.[0]} />
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
                <Link 
                    href={`/${lng}/collection/${product.categories_path[0]}`} 
                    className="text-gray-500 hover:text-gray-700 transition-colors duration-200 font-medium"
                  >
                    {product.categories_path[0]}
                  </Link>
                </li>
                <li>
                  <div className="flex items-center">
                    <ChevronLeftIcon className={`h-4 w-4 text-gray-300 mx-2 ${isRTL ? 'rotate-90' : 'rotate-270'}`} />
                  </div>
                </li>
                <li>
                  <span className="text-gray-600 font-medium">{product.sku} {currentVariant.colorSlug}</span>
                </li>
              </ol>
            </nav>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Product Images and Video */}
            <div className="space-y-4">
              {/* Main Media Carousel */}
              <div className="aspect-w-1 aspect-h-1 w-full overflow-hidden bg-gray-200 rounded-lg relative">
                {/* Media indicator dots */}
                {getTotalMediaCount() > 1 && (
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex space-x-2">
                    {Array.from({ length: getTotalMediaCount() }).map((_, index) => (
                      <div
                        key={index}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          selectedImageIndex === index ? 'bg-white' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Media Container */}
                <div 
                  className="flex h-full w-full transition-transform duration-300 ease-out"
                  style={{
                    transform: isRTL 
                      ? `translateX(${selectedImageIndex * 100}%)` 
                      : `translateX(-${selectedImageIndex * 100}%)`
                  }}
                >
                  {/* Images */}
                  {currentVariant.images && currentVariant.images.map((image, index) => (
                    <div key={`image-${index}`} className="w-full h-full flex-shrink-0 relative">
                      <Image
                        src={image}
                        alt={`${productName} - ${currentVariant.colorSlug}`}
                        width={600}
                        height={600}
                        className="h-full w-full object-cover object-center"
                        priority={index === 0}
                        unoptimized={true}
                        onError={(e) => {
                          console.error('Image failed to load:', image, 'Index:', index, 'Language:', lng)
                        }}
                        onLoad={() => {
                          console.log('Image loaded successfully:', image, 'Index:', index, 'Language:', lng)
                        }}
                      />
                    </div>
                  ))}
                  
                  {/* Videos */}
                  {currentVariant.videos && currentVariant.videos.map((video, index) => (
                    <div key={`video-${index}`} className="w-full h-full flex-shrink-0">
                      <video
                        src={video}
                        autoPlay={selectedImageIndex === (currentVariant.images?.length || 0) + index}
                        loop
                        muted
                        playsInline
                        className="h-full w-full object-cover object-center"
                        poster={currentVariant.images?.[0]}
                      >
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  ))}
                  
                  {/* Fallback for no media */}
                  {(!currentVariant.images || currentVariant.images.length === 0) && (!currentVariant.videos || currentVariant.videos.length === 0) && (
                    <div className="w-full h-full flex-shrink-0 flex items-center justify-center bg-gray-200">
                      <span className="text-gray-400">
                        {lng === 'he' ? 'אין תמונה זמינה' : 'No image available'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Thumbnail Images and Video */}
              {((currentVariant.videos && currentVariant.videos.length > 0) || (currentVariant.images && currentVariant.images.length > 0)) && (
                <div className="grid grid-cols-4 gap-2">
                  {/* Image thumbnails */}
                  {currentVariant.images && currentVariant.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setIsTransitioning(true)
                        setSelectedImageIndex(index)
                        setTimeout(() => setIsTransitioning(false), 300)
                      }}
                      className={`aspect-w-1 aspect-h-1 w-full overflow-hidden rounded-lg border-2 transition-all duration-200 ${
                        selectedImageIndex === index ? 'border-indigo-600 scale-105' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Image
                        src={image}
                        alt={`${productName} - ${currentVariant.colorSlug}`}
                        width={150}
                        height={150}
                        className="h-full w-full object-cover object-center"
                        loading="lazy"
                      />
                    </button>
                  ))}
                  
                  {/* Video thumbnails */}
                  {currentVariant.videos && currentVariant.videos.map((video, index) => {
                    const videoIndex = (currentVariant.images?.length || 0) + index
                    return (
                      <button
                        key={`video-thumb-${index}`}
                        onClick={() => {
                          setIsTransitioning(true)
                          setSelectedImageIndex(videoIndex)
                          setTimeout(() => setIsTransitioning(false), 300)
                        }}
                        className={`aspect-w-1 aspect-h-1 w-full overflow-hidden rounded-lg border-2 relative transition-all duration-200 ${
                          selectedImageIndex === videoIndex ? 'border-indigo-600 scale-105' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <video
                          src={video}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="h-full w-full object-cover object-center"
                          poster={currentVariant.images?.[0]}
                        >
                          Your browser does not support the video tag.
                        </video>
                        {/* Video play icon overlay */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-6 h-6 bg-white/80 rounded-full flex items-center justify-center">
                            <div className="w-0 h-0 border-l-[6px] border-l-gray-700 border-y-[4px] border-y-transparent ml-0.5"></div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
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
                      ₪{product.price.toFixed(2)}
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
                <p className="text-gray-600 leading-relaxed">{lng === 'he' ? product.description_he : product.description_en}</p>
              </div>

              {/* Color Selection */}
              {product.colorVariants && Object.keys(product.colorVariants).length > 1 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {lng === 'he' ? 'צבע' : 'Color'}
                  </h3>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {Object.values(product.colorVariants).map((variant) => {
                      const isCurrentVariant = variant.colorSlug === colorSlug
                      // Check if variant has any available sizes (stock > 0)
                      const isVariantOutOfStock = Object.values(variant.stockBySize).every(stock => stock <= 0)
                      const variantImage = variant.primaryImage || variant.images?.[0]
                      
                      return (
                        <button
                          key={variant.colorSlug}
                          onClick={() => {
                            console.log('Color button clicked:', { 
                              colorSlug: variant.colorSlug, 
                              isVariantOutOfStock,
                              currentColorSlug: colorSlug,
                              variantStock: Object.values(variant.stockBySize).reduce((sum, stock) => sum + stock, 0),
                              sizes: Object.entries(variant.stockBySize).map(([size, stock]) => ({ size, stock }))
                            })
                            if (!isVariantOutOfStock) {
                              handleColorChange(variant.colorSlug)
                            }
                          }}
                          disabled={isVariantOutOfStock}
                          className="flex-shrink-0 relative group"
                          title={variant.colorSlug}
                        >
                          {/* Product image */}
                          {variantImage ? (
                            <div className={`w-12 h-12 rounded-full overflow-hidden border-2 border-transparent ${
                              isVariantOutOfStock ? 'opacity-50' : ''
                            }`}>
                              <Image
                                src={variantImage}
                                alt={variant.colorSlug}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className={`w-12 h-12 rounded-full border-2 border-gray-200 flex items-center justify-center ${
                              isVariantOutOfStock ? 'opacity-50' : ''
                            }`}>
                              <span className="text-xs text-gray-500">{variant.colorSlug}</span>
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
              {Object.keys(currentVariant.stockBySize).length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {lng === 'he' ? 'מידה' : 'Size'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(currentVariant.stockBySize)
                      .filter(([size, stock]) => stock > 0) // Only show available sizes
                      .map(([size, stock]) => {
                        return (
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
                {!selectedSize && Object.keys(currentVariant.stockBySize).length > 0 && (
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
                  disabled={isOutOfStock || (Object.keys(currentVariant.stockBySize).length > 0 && !selectedSize) || isAddingToCart}
                  className={`w-full py-3 px-6 rounded-md font-medium transition-colors duration-200 flex items-center justify-center ${
                    isOutOfStock || (Object.keys(currentVariant.stockBySize).length > 0 && !selectedSize) || isAddingToCart
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
                    } else if (Object.keys(currentVariant.stockBySize).length > 0 && !selectedSize) {
                      return lng === 'he' ? 'בחר מידה' : 'Select Size'
                    } else {
                      return lng === 'he' ? 'הוסף לעגלה' : 'Add to Cart'
                    }
                  })()}
                </button>

                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      const sku = `${baseSku}-${colorSlug}-${selectedSize}`
                      toggleFavorite(sku)
                    }}
                    className={`flex-1 py-3 px-6 rounded-md font-medium border transition-colors duration-200 flex items-center justify-center ${
                      (() => {
                        const sku = `${baseSku}-${colorSlug}-${selectedSize}`
                        return isFavorite(sku)
                      })()
                        ? 'border-red-300 bg-red-50 text-red-600'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {(() => {
                      const sku = `${baseSku}-${colorSlug}-${selectedSize}`
                      return isFavorite(sku)
                    })() ? (
                      <HeartSolidIcon className="h-5 w-5 mr-2" />
                    ) : (
                      <HeartIcon className="h-5 w-5 mr-2" />
                    )}
                    {(() => {
                      const sku = `${baseSku}-${colorSlug}-${selectedSize}`
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
                        <span>{currentVariant.colorSlug}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{lng === 'he' ? 'קטגוריה' : 'Category'}:</span>
                        <span>{product.categories_path[0]}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Material & Care and Shipping & Returns Sections */}
              <div className="border-t border-gray-200 pt-6">
                <div className="space-y-4">
                  {/* Material & Care Section */}
                  {(product.materialCare?.upperMaterial_en || product.materialCare?.upperMaterial_he || 
                    product.materialCare?.materialInnerSole_en || product.materialCare?.materialInnerSole_he ||
                    product.materialCare?.lining_en || product.materialCare?.lining_he ||
                    product.materialCare?.sole_en || product.materialCare?.sole_he ||
                    product.materialCare?.heelHeight_en || product.materialCare?.heelHeight_he ||
                    // Legacy structure support
                    product.upperMaterial || product.materialInnerSole || product.lining || product.sole || product.heelHeight) && (
                    <Accordion title={lng === 'he' ? 'מפרט טכני' : 'Material & Care'}>
                      <div className="space-y-3">
                        {((product.materialCare?.upperMaterial_en || product.materialCare?.upperMaterial_he) || product.upperMaterial) && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'חומר עליון:' : 'Upper Material:'}
                            </span>
                            <span className="text-sm text-gray-900">
                              {product.materialCare?.upperMaterial_en || product.materialCare?.upperMaterial_he 
                                ? (lng === 'he' ? product.materialCare?.upperMaterial_he : product.materialCare?.upperMaterial_en)
                                : (lng === 'he' ? product.upperMaterial?.he : product.upperMaterial?.en)
                              }
                            </span>
                          </div>
                        )}
                        {((product.materialCare?.materialInnerSole_en || product.materialCare?.materialInnerSole_he) || product.materialInnerSole) && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'חומר סוליה פנימית:' : 'Material Inner Sole:'}
                            </span>
                            <span className="text-sm text-gray-900">
                              {product.materialCare?.materialInnerSole_en || product.materialCare?.materialInnerSole_he 
                                ? (lng === 'he' ? product.materialCare?.materialInnerSole_he : product.materialCare?.materialInnerSole_en)
                                : (lng === 'he' ? product.materialInnerSole?.he : product.materialInnerSole?.en)
                              }
                            </span>
                          </div>
                        )}
                        {((product.materialCare?.lining_en || product.materialCare?.lining_he) || product.lining) && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'בטנה:' : 'Lining:'}
                            </span>
                            <span className="text-sm text-gray-900">
                              {product.materialCare?.lining_en || product.materialCare?.lining_he 
                                ? (lng === 'he' ? product.materialCare?.lining_he : product.materialCare?.lining_en)
                                : (lng === 'he' ? product.lining?.he : product.lining?.en)
                              }
                            </span>
                          </div>
                        )}
                        {((product.materialCare?.sole_en || product.materialCare?.sole_he) || product.sole) && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'סוליה:' : 'Sole:'}
                            </span>
                            <span className="text-sm text-gray-900">
                              {product.materialCare?.sole_en || product.materialCare?.sole_he 
                                ? (lng === 'he' ? product.materialCare?.sole_he : product.materialCare?.sole_en)
                                : (lng === 'he' ? product.sole?.he : product.sole?.en)
                              }
                            </span>
                          </div>
                        )}
                        {((product.materialCare?.heelHeight_en || product.materialCare?.heelHeight_he) || product.heelHeight) && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              {lng === 'he' ? 'גובה עקב:' : 'Heel Height:'}
                            </span>
                            <span className="text-sm text-gray-900">
                              {product.materialCare?.heelHeight_en || product.materialCare?.heelHeight_he 
                                ? (lng === 'he' ? product.materialCare?.heelHeight_he : product.materialCare?.heelHeight_en)
                                : (lng === 'he' ? product.heelHeight?.he : product.heelHeight?.en)
                              }
                            </span>
                          </div>
                        )}
                      </div>
                    </Accordion>
                  )}

                  {/* Shipping & Returns Section */}
                  <Accordion title={lng === 'he' ? 'משלוחים והחזרות' : 'Shipping & Returns'}>
                    <div className="text-sm text-gray-600 leading-relaxed">
                      {product.shippingReturns ? (
                        // Custom shipping returns content if provided by admin
                        lng === 'he' ? product.shippingReturns.he : product.shippingReturns.en
                      ) : (
                        // Default shipping returns content
                        lng === 'he' ? (
                          <div className="space-y-3">
                            <p><strong>משלוחים:</strong></p>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                              <li>משלוח חינם על הזמנות מעל 300 ₪</li>
                              <li>משלוח מהיר תוך 1-2 ימי עסקים</li>
                              <li>משלוח לכל הארץ</li>
                              <li>מעקב אחר המשלוח במייל</li>
                            </ul>
                            <p><strong>החזרות:</strong></p>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                              <li>זכות החזרה תוך 30 יום</li>
                              <li>החזרה חינמית</li>
                              <li>המוצר חייב להיות במצב מקורי</li>
                              <li>החזר כספי תוך 3-5 ימי עסקים</li>
                            </ul>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p><strong>Shipping:</strong></p>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                              <li>Free shipping on orders over ₪300</li>
                              <li>Fast shipping within 1-2 business days</li>
                              <li>Nationwide delivery</li>
                              <li>Email tracking updates</li>
                            </ul>
                            <p><strong>Returns:</strong></p>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                              <li>30-day return policy</li>
                              <li>Free returns</li>
                              <li>Items must be in original condition</li>
                              <li>Refund processed within 3-5 business days</li>
                            </ul>
                          </div>
                        )
                      )}
                    </div>
                  </Accordion>
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
