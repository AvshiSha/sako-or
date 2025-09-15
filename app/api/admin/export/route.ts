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
      product.colorVariants?.forEach(variant => {
        variant.sizes?.forEach(size => {
          if (size.size && size.stock !== null) {
            if (!stockBySize[size.size]) {
              stockBySize[size.size] = 0
            }
            stockBySize[size.size] += size.stock
          }
        })
      })

      // Convert to string format for import compatibility
      const stockBySizeString = Object.entries(stockBySize)
        .map(([size, stock]) => `${size}:${stock}`)
        .join(',')

      return {
        name: product.name,
        description: product.description,
        slug: product.slug,
        price: product.colorVariants?.[0]?.price || product.price,
        category: product.category?.name || 'uncategorized',
        subcategory: '', // Subcategory not available in current Product interface
        images: product.colorVariants?.[0]?.images?.map(img => img.url).join(',') || '',
        sizes: product.colorVariants?.[0]?.sizes?.map(s => s.size).join(',') || '',
        colors: product.colorVariants?.map(v => v.colorName).join(',') || '',
        stockBySize: stockBySizeString,
        sku: product.baseSku || product.sku || '',
        featured: product.featured || false,
        new: product.isNew || false,
        salePrice: product.colorVariants?.[0]?.salePrice || null,
        saleStartDate: product.colorVariants?.[0]?.saleStartDate || null,
        saleEndDate: product.colorVariants?.[0]?.saleEndDate || null
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
