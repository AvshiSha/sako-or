'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { productService } from '@/lib/firebase'

export default function ProductRedirectPage() {
  const params = useParams()
  const router = useRouter()
  
  const lng = params?.lng as string || 'en'
  const baseSku = params?.baseSku as string

  useEffect(() => {
    const redirectToDefaultColor = async () => {
      if (!baseSku) return

      try {
        // Get product with color variants
        const product = await productService.getProductWithColorVariants(baseSku)
        
        if (!product || !product.colorVariants || Object.keys(product.colorVariants).length === 0) {
          // If no product or variants found, redirect to collection
          router.replace(`/${lng}/collection`)
          return
        }

        // Find the first available color variant
        const variants = Object.values(product.colorVariants)
        const defaultVariant = variants[0]
        
        if (defaultVariant) {
          // Redirect to the default color variant
          router.replace(`/${lng}/product/${baseSku}/${defaultVariant.colorSlug}`)
        } else {
          // Fallback: redirect to collection
          router.replace(`/${lng}/collection`)
        }
      } catch (error) {
        console.error('Error redirecting to default color:', error)
        // Fallback: redirect to collection
        router.replace(`/${lng}/collection`)
      }
    }

    redirectToDefaultColor()
  }, [baseSku, lng, router])

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">
          {lng === 'he' ? 'מעביר למוצר...' : 'Redirecting to product...'}
        </p>
      </div>
    </div>
  )
}
