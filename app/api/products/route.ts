import { NextRequest, NextResponse } from 'next/server'
import { productService, Product } from '@/lib/firebase'
import { z } from 'zod'

// Validation schema for creating/updating products
const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().min(1, 'Description is required'),
  price: z.number().positive('Price must be positive'),
  salePrice: z.number().positive().optional(),
  saleStartDate: z.string().optional(),
  saleEndDate: z.string().optional(),
  sku: z.string().optional(),
  stock: z.number().int().min(0, 'Stock must be non-negative'),
  featured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isActive: z.boolean().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  images: z.array(z.object({
    url: z.string().url('Invalid image URL'),
    alt: z.string().optional(),
    isPrimary: z.boolean().optional(),
    order: z.number().int().min(0).optional()
  })).optional(),
  variants: z.array(z.object({
    size: z.string().optional(),
    color: z.string().optional(),
    stock: z.number().int().min(0),
    sku: z.string().optional(),
    price: z.number().positive().optional()
  })).optional(),
  tags: z.array(z.string()).optional()
})

// GET /api/products - Get all products with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const featured = searchParams.get('featured')
    const isNew = searchParams.get('new')
    const isActive = searchParams.get('active')
    const limit = parseInt(searchParams.get('limit') || '20')

    const filters: any = {}
    
    if (category) filters.category = category
    if (featured === 'true') filters.featured = true
    if (isNew === 'true') filters.isNew = true
    if (isActive === 'true') filters.isActive = true
    if (limit) filters.limit = limit

    const products = await productService.getAllProducts(filters)

    return NextResponse.json({
      products,
      pagination: {
        total: products.length,
        limit
      }
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

// POST /api/products - Create a new product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = productSchema.parse(body)

    // Check if product with same slug already exists
    const existingProduct = await productService.getProductBySlug(validatedData.slug)

    if (existingProduct) {
      return NextResponse.json(
        { error: 'Product with this slug already exists' },
        { status: 400 }
      )
    }

    // Prepare product data
    const productData = {
      name: validatedData.name,
      slug: validatedData.slug,
      description: validatedData.description,
      price: validatedData.price,
      salePrice: validatedData.salePrice,
      saleStartDate: validatedData.saleStartDate ? new Date(validatedData.saleStartDate) : undefined,
      saleEndDate: validatedData.saleEndDate ? new Date(validatedData.saleEndDate) : undefined,
      sku: validatedData.sku,
      stock: validatedData.stock,
      featured: validatedData.featured || false,
      isNew: validatedData.isNew || false,
      isActive: validatedData.isActive !== false,
      categoryId: validatedData.categoryId,
      images: validatedData.images?.map((img, index) => ({
        url: img.url,
        alt: img.alt,
        isPrimary: img.isPrimary || index === 0,
        order: img.order || index,
        createdAt: new Date()
      })) || [],
      variants: validatedData.variants?.map(variant => ({
        size: variant.size,
        color: variant.color,
        stock: variant.stock,
        sku: variant.sku,
        price: variant.price,
        createdAt: new Date(),
        updatedAt: new Date()
      })) || [],
      tags: validatedData.tags || []
    }

    // Create product
    const productId = await productService.createProduct(productData)

    // Get the created product
    const product = await productService.getProductById(productId)

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
} 