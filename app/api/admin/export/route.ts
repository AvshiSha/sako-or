import { NextResponse } from 'next/server'
import { productService } from '@/lib/firebase'

export async function GET() {
  try {
    // Fetch all products with their details
    const products = await productService.getAllProducts({})
    
    // Transform products to the format expected by the import system
    const exportData = products.map(product => {
      // Group variants by size and sum their stock
      const stockBySize: Record<string, number> = {}
      product.variants?.forEach(variant => {
        if (variant.size && variant.stock !== null) {
          if (!stockBySize[variant.size]) {
            stockBySize[variant.size] = 0
          }
          stockBySize[variant.size] += variant.stock
        }
      })

      // Convert to string format for import compatibility
      const stockBySizeString = Object.entries(stockBySize)
        .map(([size, stock]) => `${size}:${stock}`)
        .join(',')

      return {
        name: product.name,
        description: product.description,
        slug: product.slug,
        price: product.price,
        category: product.category?.name || 'uncategorized',
        subcategory: product.subcategory || '',
        images: product.images?.map(img => img.url).join(',') || '',
        sizes: product.sizes?.join(',') || '',
        colors: product.colors?.join(',') || '',
        stockBySize: stockBySizeString,
        sku: product.sku || '',
        featured: product.featured || false,
        new: product.isNew || false,
        salePrice: product.salePrice || null,
        saleStartDate: product.saleStartDate || null,
        saleEndDate: product.saleEndDate || null
      }
    })

    return NextResponse.json(exportData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="products-export.json"'
      }
    })
  } catch (error) {
    console.error('Error exporting products:', error)
    return NextResponse.json(
      { error: 'Failed to export products' },
      { status: 500 }
    )
  }
}
