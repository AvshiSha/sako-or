'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
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
import { productService, productHelpers, Product } from '@/lib/firebase'
import { analytics } from '@/lib/firebase'
import ProductLanguageSwitcher from '@/app/components/ProductLanguageSwitcher'
import { useFavorites } from '@/app/hooks/useFavorites'
import { useCart } from '@/app/hooks/useCart'
import Toast, { useToast } from '@/app/components/Toast'

export default function ProductPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [selectedColor, setSelectedColor] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [isClient, setIsClient] = useState(false)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  
  // Favorites hook
  const { isFavorite, toggleFavorite } = useFavorites()
  
  // Cart hook
  const { addToCart } = useCart()
  
  // Toast hook
  const { toast, showToast, hideToast } = useToast()

  // Get language and SKU from params
  const lng = params?.lng as string || 'en'
  const sku = params?.sku as string

  // Get variant selections from URL params
  const sizeParam = searchParams?.get('size')
  const colorParam = searchParams?.get('color')

  // Client-side only effect
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Fetch product data by SKU
  useEffect(() => {
    if (!sku || !isClient) return

    const fetchProduct = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // First try to get product by SKU
        let productData = await productService.getProductBySku(sku)
        
        // If not found by SKU, try by slug (for old URLs)
        if (!productData) {
          productData = await productService.getProductBySlug(sku, lng as 'en' | 'he')
          
          // If found by slug, redirect to SKU-based URL
          if (productData && productData.sku) {
            const currentUrl = new URL(window.location.href)
            const newUrl = `/${lng}/product/${productData.sku}${currentUrl.search}`
            window.location.replace(newUrl)
            return
          }
        }
        
        if (!productData) {
          setError('Product not found')
          setLoading(false)
          return
        }

        setProduct(productData)
        
        // Set default selections from URL params or first available options
        if (productData) {
          if (productData.sizes && productData.sizes.length > 0) {
            setSelectedSize(sizeParam || productData.sizes[0])
          }
          if (productData.colors && productData.colors.length > 0) {
            setSelectedColor(colorParam || productData.colors[0])
          }
        }

        // Fire Product View analytics event
        if (analytics && productData && typeof analytics.logEvent === 'function') {
          try {
            analytics.logEvent('view_item', {
              currency: productData.currency || 'USD',
              value: productData.salePrice || productData.price,
              items: [{
                item_id: productData.sku,
                item_name: productHelpers.getField(productData, 'name', lng as 'en' | 'he'),
                item_category: productData.category?.name || 'Unknown',
                price: productData.salePrice || productData.price,
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
  }, [sku, lng, isClient, sizeParam, colorParam])

  // Check if variant is in stock
  const getVariantStock = useCallback((size?: string, color?: string) => {
    // If we have stock by size data, use that
    if (product?.stockBySize && size && product.stockBySize[size] !== undefined) {
      return product.stockBySize[size]
    }
    
    // Fallback to variants if available
    if (product?.variants) {
      const variant = product.variants.find(v => 
        (!size || v.size === size) && (!color || v.color === color)
      )
      return variant ? variant.stock : 0
    }
    
    // Fallback to total stock
    return product?.stock || 0
  }, [product])

  // Reset quantity when size changes to ensure it doesn't exceed stock
  useEffect(() => {
    if (selectedSize && product) {
      const sizeStock = getVariantStock(selectedSize, selectedColor)
      if (quantity > sizeStock) {
        setQuantity(Math.max(1, sizeStock))
      }
    }
  }, [selectedSize, selectedColor, product, quantity, getVariantStock])

  // Update URL when variant selections change
  useEffect(() => {
    if (!isClient || !product) return

    const newParams = new URLSearchParams(searchParams?.toString() || '')
    if (selectedSize) newParams.set('size', selectedSize)
    if (selectedColor) newParams.set('color', selectedColor)
    
    const newUrl = `${window.location.pathname}?${newParams.toString()}`
    if (newUrl !== window.location.href) {
      window.history.replaceState({}, '', newUrl)
    }
  }, [selectedSize, selectedColor, isClient, product, searchParams])

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

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {lng === 'he' ? 'מוצר לא נמצא' : 'Product Not Found'}
          </h1>
          <p className="text-gray-600 mb-6">
            {lng === 'he' 
              ? 'המוצר שחיפשת לא קיים או הוסר מהקטלוג.' 
              : 'The product you\'re looking for doesn\'t exist or has been removed from the catalog.'
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

  // Get current price (sale price if available and valid)
  const currentPrice = product.salePrice && 
    (!product.saleStartDate || new Date() >= product.saleStartDate) &&
    (!product.saleEndDate || new Date() <= product.saleEndDate)
    ? product.salePrice 
    : product.price

  const currentStock = getVariantStock(selectedSize, selectedColor)
  const isOutOfStock = currentStock <= 0

  const handleAddToCart = async () => {
    if (isOutOfStock || isAddingToCart) return

    setIsAddingToCart(true)

    // Fire Add to Cart analytics event
    if (analytics) {
      try {
        analytics.logEvent('add_to_cart', {
          currency: product.currency || 'USD',
          value: currentPrice * quantity,
          items: [{
            item_id: product.sku,
            item_name: productName,
            item_category: product.category?.name || 'Unknown',
            item_variant: `${selectedSize || ''}-${selectedColor || ''}`.replace(/^-|-$/g, ''),
            price: currentPrice,
            quantity: quantity
          }]
        })
      } catch (analyticsError) {
        console.warn('Analytics error:', analyticsError)
      }
    }

    // Add to cart
    if (product.sku) {
      addToCart({
        sku: product.sku,
        name: {
          en: product.name?.en || '',
          he: product.name?.he || ''
        },
        price: product.price,
        salePrice: product.salePrice,
        currency: product.currency,
        image: product.images?.[0]?.url,
        size: selectedSize,
        color: selectedColor,
        maxStock: currentStock
      })
      
      // Add multiple items if quantity > 1
      for (let i = 1; i < quantity; i++) {
        addToCart({
          sku: product.sku,
          name: {
            en: product.name?.en || '',
            he: product.name?.he || ''
          },
          price: product.price,
          salePrice: product.salePrice,
          currency: product.currency,
          image: product.images?.[0]?.url,
          size: selectedSize,
          color: selectedColor,
          maxStock: currentStock
        })
      }
      
      // Show success toast
      const successMessage = lng === 'he' 
        ? `הוספת ${quantity} ${quantity === 1 ? 'פריט' : 'פריטים'} לעגלה` 
        : `Added ${quantity} ${quantity === 1 ? 'item' : 'items'} to cart`
      showToast(successMessage, 'success')
    }
    
    // Reset button state after a short delay
    setTimeout(() => {
      setIsAddingToCart(false)
    }, 1000)
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

  // Generate structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": productName,
    "description": productDescription,
    "sku": product.sku,
    "brand": {
      "@type": "Brand",
      "name": "Sako"
    },
    "offers": {
      "@type": "Offer",
      "price": currentPrice,
      "priceCurrency": product.currency || "USD",
      "availability": isOutOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      "url": window.location.href
    },
    "image": product.images?.map(img => img.url) || [],
    "category": product.category?.name
  }

  return (
    <>
      <Head>
        <title>{productName} | Sako</title>
        <meta name="description" content={productDescription} />
        <meta name="keywords" content={`${productName}, ${product.category?.name}, shoes, footwear, ${product.sku}`} />
        
        {/* Canonical URL */}
        <link rel="canonical" href={`https://sako-or.com/${lng}/product/${sku}`} />
        
        {/* Hreflang for language alternatives */}
        <link rel="alternate" hrefLang="en" href={`https://sako-or.com/en/product/${sku}`} />
        <link rel="alternate" hrefLang="he" href={`https://sako-or.com/he/product/${sku}`} />
        <link rel="alternate" hrefLang="x-default" href={`https://sako-or.com/en/product/${sku}`} />
        
        {/* Open Graph */}
        <meta property="og:title" content={productName} />
        <meta property="og:description" content={productDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://sako-or.com/${lng}/product/${sku}`} />
        <meta property="og:image" content={product.images?.[0]?.url} />
        <meta property="og:site_name" content="Sako" />
        <meta property="product:price:amount" content={currentPrice.toString()} />
        <meta property="product:price:currency" content={product.currency || "USD"} />
        <meta property="product:availability" content={isOutOfStock ? "out of stock" : "in stock"} />
        <meta property="product:condition" content="new" />
        <meta property="product:brand" content="Sako" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={productName} />
        <meta name="twitter:description" content={productDescription} />
        <meta name="twitter:image" content={product.images?.[0]?.url} />
      </Head>

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className={`min-h-screen bg-white ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Breadcrumb Navigation */}
        <nav className="bg-gray-50 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              <div className={`flex items-center space-x-2 ${isRTL ? 'space-x-reverse' : ''}`}>
                <Link href={`/${lng}`} className="text-gray-500 hover:text-gray-700">
                  {lng === 'he' ? 'בית' : 'Home'}
                </Link>
                <ChevronLeftIcon className={`h-4 w-4 text-gray-400 ${isRTL ? 'rotate-90' : 'rotate-270'}`} />
                <Link href={`/${lng}/collection`} className="text-gray-500 hover:text-gray-700">
                  {lng === 'he' ? 'אוסף' : 'Collection'}
                </Link>
                <ChevronLeftIcon className={`h-4 w-4 text-gray-400 ${isRTL ? 'rotate-90' : 'rotate-270'}`} />
                <span className="text-gray-900">{productName}</span>
              </div>
              <ProductLanguageSwitcher currentLanguage={lng} sku={sku} />
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
                <h1 className="text-3xl font-bold text-gray-900">{productName}</h1>
              </div>

              {/* Price */}
              <div className="flex items-center space-x-4">
                <span className="text-3xl font-bold text-gray-900">
                ₪{currentPrice.toFixed(2)}
                </span>
                {product.salePrice && currentPrice === product.salePrice && (
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

              {/* Stock Status */}
              <div className="flex items-center space-x-2">
                {isOutOfStock ? (
                  <span className="text-red-600 font-medium">
                    {lng === 'he' ? 'אזל מהמלאי' : 'Out of Stock'}
                  </span>
                ) : (
                  <span className="text-green-600 font-medium">
                    {lng === 'he' ? `זמין במלאי (${currentStock} יחידות)` : `In Stock (${currentStock} units)`}
                  </span>
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
                    {product.sizes.map((size) => {
                      const sizeStock = getVariantStock(size, selectedColor)
                      const isSizeOutOfStock = sizeStock <= 0
                      
                      return (
                        <button
                          key={size}
                          onClick={() => !isSizeOutOfStock && setSelectedSize(size)}
                          disabled={isSizeOutOfStock}
                          className={`px-4 py-2 border rounded-md text-sm font-medium ${
                            selectedSize === size
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                              : isSizeOutOfStock
                              ? 'border-gray-200 text-gray-400 cursor-not-allowed'
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

              {/* Color Selection */}
              {product.colors && product.colors.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {lng === 'he' ? 'צבע' : 'Color'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {product.colors.map((color) => {
                      const colorStock = getVariantStock(selectedSize, color)
                      const isColorOutOfStock = colorStock <= 0
                      
                      return (
                        <button
                          key={color}
                          onClick={() => !isColorOutOfStock && setSelectedColor(color)}
                          disabled={isColorOutOfStock}
                          className={`w-8 h-8 rounded-full border-2 ${
                            selectedColor === color 
                              ? 'border-indigo-600' 
                              : isColorOutOfStock
                              ? 'border-gray-200 opacity-50 cursor-not-allowed'
                              : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: color.toLowerCase() }}
                          title={`${color}${isColorOutOfStock ? ' (Out of Stock)' : ''}`}
                        />
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
                {!selectedSize && product.sizes && product.sizes.length > 0 && (
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
                  disabled={isOutOfStock || (product.sizes && product.sizes.length > 0 && !selectedSize) || isAddingToCart}
                  className={`w-full py-3 px-6 rounded-md font-medium transition-colors duration-200 flex items-center justify-center ${
                    isOutOfStock || (product.sizes && product.sizes.length > 0 && !selectedSize) || isAddingToCart
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
                    } else if (product.sizes && product.sizes.length > 0 && !selectedSize) {
                      return lng === 'he' ? 'בחר מידה' : 'Select Size'
                    } else {
                      return lng === 'he' ? 'הוסף לעגלה' : 'Add to Cart'
                    }
                  })()}
                </button>

                <div className="flex space-x-4">
                  <button
                    onClick={() => product.sku && toggleFavorite(product.sku)}
                    className={`flex-1 py-3 px-6 rounded-md font-medium border transition-colors duration-200 flex items-center justify-center ${
                      product.sku && isFavorite(product.sku)
                        ? 'border-red-300 bg-red-50 text-red-600'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {product.sku && isFavorite(product.sku) ? (
                      <HeartSolidIcon className="h-5 w-5 mr-2" />
                    ) : (
                      <HeartIcon className="h-5 w-5 mr-2" />
                    )}
                    {product.sku && isFavorite(product.sku)
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
                        <span>{product.sku}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{lng === 'he' ? 'קטגוריה' : 'Category'}:</span>
                        <span>{product.category?.name}</span>
                      </div>
                      {product.currency && (
                        <div className="flex justify-between">
                          <span>{lng === 'he' ? 'מטבע' : 'Currency'}:</span>
                          <span>{product.currency}</span>
                        </div>
                      )}
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
