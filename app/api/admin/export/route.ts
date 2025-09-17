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
      if (product.colorVariants) {
        Object.values(product.colorVariants).forEach(variant => {
          Object.entries(variant.stockBySize).forEach(([size, stock]) => {
            if (size && stock !== null) {
              if (!stockBySize[size]) {
                stockBySize[size] = 0
              }
              stockBySize[size] += stock
            }
          })
        })
      }

      // Convert to string format for import compatibility
      const stockBySizeString = Object.entries(stockBySize)
        .map(([size, stock]) => `${size}:${stock}`)
        .join(',')

      return {
        name: product.name,
        description: product.description,
        slug: product.slug,
        price: product.price,
        category: product.category || 'uncategorized',
        subcategory: '', // Subcategory not available in current Product interface
        images: product.colorVariants ? Object.values(product.colorVariants)[0]?.images?.join(',') || '' : '',
        sizes: product.colorVariants ? Object.keys(Object.values(product.colorVariants)[0]?.stockBySize || {}).join(',') : '',
        colors: product.colorVariants ? Object.values(product.colorVariants).map(v => v.colorSlug).join(',') : '',
        stockBySize: stockBySizeString,
        sku: product.baseSku || product.sku || '',
        featured: product.featured || false,
        new: product.isNew || false,
        salePrice: product.salePrice || null,
        saleStartDate: null,
        saleEndDate: null
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
