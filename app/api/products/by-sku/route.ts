import { NextRequest, NextResponse } from 'next/server'
import { productService } from '@/lib/firebase'

// GET /api/products/by-sku?sku=12345
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sku = searchParams.get('sku')

    if (!sku) {
      return NextResponse.json(
        { error: 'Missing sku parameter' },
        { status: 400 }
      )
    }

    const product = await productService.getProductByBaseSku(sku)

    if (!product || product.isDeleted || product.isEnabled === false) {
      return NextResponse.json(
        { error: 'Product not found or not available' },
        { status: 404 }
      )
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error fetching product by SKU:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product by SKU' },
      { status: 500 }
    )
  }
}

// OPTIONS for CORS preflight if needed
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}



