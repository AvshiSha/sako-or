import { NextRequest, NextResponse } from 'next/server'
import { productService } from '@/lib/firebase'

// GET /api/products/[id] - Get specific product
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = await productService.getProductById(params.id)
    
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

// PUT /api/products/[id] - Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    // Validate that product exists
    const existingProduct = await productService.getProductById(params.id)
    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Update product
    await productService.updateProduct(params.id, {
      ...body,
      updatedAt: new Date()
    })

    // Get updated product
    const updatedProduct = await productService.getProductById(params.id)

    return NextResponse.json(updatedProduct)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    )
  }
}

// DELETE /api/products/[id] - Delete product
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate that product exists
    const existingProduct = await productService.getProductById(params.id)
    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Delete product
    await productService.deleteProduct(params.id)

    return NextResponse.json({ message: 'Product deleted successfully' })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    )
  }
} 