'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import Accordion from '@/app/components/Accordion'
import { productService } from '@/lib/firebase'



export default function ProductPage() {
  const params = useParams()
  const slug = typeof params.slug === 'string' ? params.slug : Array.isArray(params.slug) ? params.slug[0] : ''
  const [product, setProduct] = useState<any>(null) // TODO: Add proper Product type
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isZoomed, setIsZoomed] = useState(false)
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 })

  // const lng = params?.lng || 'en'

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true)
      setError(null)
      try {
        const prod = await productService.getProductBySlug(slug)
        setProduct(prod)
        setSelectedColor(prod?.colors?.[0] || null)
        setSelectedSize(prod?.sizes?.[0] || null)
      } catch {
        setError('Product not found')
      } finally {
        setLoading(false)
      }
    }
    if (slug) fetchProduct()
  }, [slug])

  if (loading) return <div className="max-w-4xl mx-auto py-16 text-center">Loading...</div>
  if (error || !product) return <div className="max-w-4xl mx-auto py-16 text-center text-red-600">{error || 'Product not found'}</div>

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
    <div className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Images */}
          <div className="lg:w-1/2">
            <div className="flex flex-col gap-4">
              <div className="flex gap-2 mb-4">
                {product.images?.map((img: any, idx: number) => ( // TODO: Add proper ProductImage type
                  <button key={idx} onClick={() => handleImageClick(idx)} className={`border rounded-md overflow-hidden w-20 h-20 ${currentImageIndex === idx ? 'border-indigo-600' : 'border-gray-200'}`}>
                    <Image src={img.url} alt={img.alt || product.name} width={80} height={80} className="object-cover w-full h-full" />
                    </button>
                  ))}
              </div>
              <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-50">
                {product.images && product.images[currentImageIndex] && (
                  <Image
                    src={product.images[currentImageIndex].url}
                    alt={product.images[currentImageIndex].alt || product.name}
                    width={600}
                    height={600}
                    className="object-cover w-full h-full"
                  onMouseEnter={() => setIsZoomed(true)}
                  onMouseLeave={() => setIsZoomed(false)}
                  onMouseMove={handleMouseMove}
                  />
                )}
                  {isZoomed && (
                    <div
                      className="absolute inset-0 bg-no-repeat bg-[length:200%]"
                      style={{
                      backgroundImage: `url(${product.images[currentImageIndex]?.url})`,
                        backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`
                      }}
                    />
                  )}
              </div>
            </div>
          </div>
          {/* Product Info */}
          <div className="flex-1 space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
            <div className="text-xl text-indigo-700 font-semibold">
              {product.currency === 'ILS' ? '₪' : '$'}{product.price?.toFixed(2)}
                </div>
            {product.salePrice && (
              <div className="text-lg text-red-600 font-semibold">
                Sale: {product.currency === 'ILS' ? '₪' : '$'}{product.salePrice?.toFixed(2)}
              </div>
            )}
            <div className="text-gray-700 text-base whitespace-pre-line">{product.description}</div>
            {product.descriptionHe && <div className="text-gray-500 text-sm whitespace-pre-line">{product.descriptionHe}</div>}
            <div className="flex flex-col gap-4 mt-6">
              {/* Sizes */}
              {product.sizes && product.sizes.length > 0 && (
                <div>
                  <div className="font-medium text-gray-800 mb-1">Available Sizes:</div>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((size: any, idx: number) => ( // TODO: Add proper type
                      <button key={idx} onClick={() => setSelectedSize(size)} className={`px-3 py-1 rounded border ${selectedSize === size ? 'bg-indigo-600 text-white' : 'bg-white text-gray-900 border-gray-300'}`}>{size}</button>
                    ))}
                  </div>
                </div>
              )}
              {/* Colors */}
              {product.colors && product.colors.length > 0 && (
                <div>
                  <div className="font-medium text-gray-800 mb-1">Available Colors:</div>
                  <div className="flex flex-wrap gap-2">
                    {product.colors.map((color: any, idx: number) => ( // TODO: Add proper type
                      <button key={idx} onClick={() => setSelectedColor(color)} className={`px-3 py-1 rounded border ${selectedColor === color ? 'bg-indigo-600 text-white' : 'bg-white text-gray-900 border-gray-300'}`}>{color}</button>
                  ))}
                  </div>
                </div>
              )}
              {/* Brand, Category, Subcategory */}
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-2">
                {product.brand && <span><span className="font-medium">Brand:</span> {product.brand}</span>}
                {product.category?.name && <span><span className="font-medium">Category:</span> {product.category.name}</span>}
                {product.subcategory && <span><span className="font-medium">Subcategory:</span> {product.subcategory}</span>}
                {product.sku && <span><span className="font-medium">SKU:</span> {product.sku}</span>}
              </div>
              {/* Stock */}
              <div className="text-sm text-gray-600">{product.stock > 0 ? `In stock: ${product.stock}` : 'Out of stock'}</div>
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
                  <p className="mt-1 text-sm text-gray-600">{product.details?.materials}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-800">Sole</h4>
                  <p className="mt-1 text-sm text-gray-600">{product.details?.sole}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-800">Lining</h4>
                  <p className="mt-1 text-sm text-gray-600">{product.details?.lining}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-800">Made In</h4>
                  <p className="mt-1 text-sm text-gray-600">{product.details?.madeIn}</p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-800">Product Code</h4>
                <p className="mt-1 text-sm text-gray-600">{product.details?.productCode}</p>
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
    </div>
  )
} 