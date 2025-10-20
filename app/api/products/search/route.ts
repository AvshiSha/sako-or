import { NextRequest, NextResponse } from 'next/server'
import { productService } from '@/lib/firebase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const lng = searchParams.get('lng') || 'en'
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json({ products: [] })
    }

    const searchQuery = query.toLowerCase().trim()
    
    // Get all active products
    const allProducts = await productService.getAllProducts({ isActive: true })
    
    // Filter products based on search query
    const filteredProducts = allProducts.filter(product => {
      // Search in SKU (exact and partial match)
      if (product.sku && product.sku.toLowerCase().includes(searchQuery)) {
        return true
      }
      
      // Search in English title
      if (product.title_en && product.title_en.toLowerCase().includes(searchQuery)) {
        return true
      }
      
      // Search in Hebrew title
      if (product.title_he && product.title_he.toLowerCase().includes(searchQuery)) {
        return true
      }
      
      // Search in tags/keywords
      if (product.tags && Array.isArray(product.tags)) {
        const hasMatchingTag = product.tags.some(tag => 
          tag.toLowerCase().includes(searchQuery)
        )
        if (hasMatchingTag) return true
      }
      
      // Search in color variant slugs
      if (product.colorVariants) {
        const hasMatchingColor = Object.values(product.colorVariants).some(variant => 
          variant.colorSlug.toLowerCase().includes(searchQuery)
        )
        if (hasMatchingColor) return true
      }
      
      return false
    })
    
    // Limit results to 20 for performance
    const limitedResults = filteredProducts.slice(0, 20)
    
    return NextResponse.json({ 
      products: limitedResults,
      total: filteredProducts.length,
      showing: limitedResults.length
    })
    
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Failed to search products', products: [] },
      { status: 500 }
    )
  }
}

