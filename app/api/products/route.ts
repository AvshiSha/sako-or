import { NextRequest, NextResponse } from 'next/server'
import { productService } from '@/lib/firebase'
import { z } from 'zod'

// Validation schema for creating/updating products
const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  title_en: z.string().min(1, 'English title is required'),
  title_he: z.string().min(1, 'Hebrew title is required'),
  description_en: z.string().min(1, 'English description is required'),
  description_he: z.string().min(1, 'Hebrew description is required'),
  category: z.string().min(1, 'Category is required'),
  subCategory: z.string().optional(),
  subSubCategory: z.string().optional(),
  categories_path: z.array(z.string()).optional(),
  categories_path_id: z.array(z.string()).optional(),
  brand: z.string().min(1, 'Brand is required'),
  price: z.coerce.number().positive('Price must be positive'),
  salePrice: z.coerce.number().positive().optional(),
  currency: z.string().default('ILS'),
  colorVariants: z.record(z.string(), z.object({
    colorSlug: z.string(),
    isActive: z.boolean().optional().default(true),
    priceOverride: z.coerce.number().positive().optional(),
    salePrice: z.coerce.number().positive().optional(),
    stockBySize: z.record(z.string(), z.coerce.number().int().min(0)),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    images: z.array(z.string()),
    primaryImage: z.string().optional(),
    videos: z.array(z.string()).optional()
  })),
  isEnabled: z.boolean().default(true),
  isDeleted: z.boolean().default(false),
  newProduct: z.boolean().default(false),
  featuredProduct: z.boolean().default(false),
  materialCare: z.object({
    upperMaterial_en: z.string().optional(),
    upperMaterial_he: z.string().optional(),
    materialInnerSole_en: z.string().optional(),
    materialInnerSole_he: z.string().optional(),
    lining_en: z.string().optional(),
    lining_he: z.string().optional(),
    sole_en: z.string().optional(),
    sole_he: z.string().optional(),
    heelHeight_en: z.string().optional(),
    heelHeight_he: z.string().optional()
  }).optional(),
  seo: z.object({
    title_en: z.string().optional(),
    title_he: z.string().optional(),
    description_en: z.string().optional(),
    description_he: z.string().optional(),
    slug: z.string().optional()
  }).optional(),
  searchKeywords: z.array(z.string()).optional()
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

    const filters: Record<string, unknown> = {}
    
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

    // Check if product with same SKU already exists
    const existingProductBySku = await productService.getProductBySku(validatedData.sku)

    if (existingProductBySku) {
      return NextResponse.json(
        { error: 'Product with this SKU already exists' },
        { status: 400 }
      )
    }

    // Prepare product data for the new structure
    const productData = {
      sku: validatedData.sku,
      title_en: validatedData.title_en,
      title_he: validatedData.title_he,
      description_en: validatedData.description_en,
      description_he: validatedData.description_he,
      category: validatedData.category,
      subCategory: validatedData.subCategory,
      subSubCategory: validatedData.subSubCategory,
      categories_path: validatedData.categories_path || [],
      categories_path_id: validatedData.categories_path_id || [],
      brand: validatedData.brand,
      price: validatedData.price,
      salePrice: validatedData.salePrice,
      currency: validatedData.currency,
      colorVariants: validatedData.colorVariants,
      isEnabled: validatedData.isEnabled,
      isDeleted: validatedData.isDeleted,
      newProduct: validatedData.newProduct,
      featuredProduct: validatedData.featuredProduct,
      materialCare: validatedData.materialCare,
      seo: validatedData.seo,
      searchKeywords: validatedData.searchKeywords || [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Create product - cast to the expected type since we're using the new structure
    const productId = await productService.createProduct(productData as any)

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