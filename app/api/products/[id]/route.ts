import { NextRequest, NextResponse } from 'next/server'
import { productService } from '@/lib/firebase'
import { z } from 'zod'

// Validation schema for updating products
const productUpdateSchema = z.object({
  name: z.object({
    en: z.string().min(1, 'English name is required'),
    he: z.string().min(1, 'Hebrew name is required')
  }),
  slug: z.object({
    en: z.string().min(1, 'English slug is required'),
    he: z.string().min(1, 'Hebrew slug is required')
  }),
  description: z.object({
    en: z.string().min(1, 'English description is required'),
    he: z.string().min(1, 'Hebrew description is required')
  }),
  price: z.number().positive('Price must be positive'),
  salePrice: z.number().positive().optional(),
  saleStartDate: z.string().nullable().optional(),
  saleEndDate: z.string().nullable().optional(),
  sku: z.string().min(1, 'SKU is required'),
  stock: z.number().int().min(0, 'Stock must be non-negative'),
  featured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isActive: z.boolean().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  images: z.array(z.object({
    url: z.string().url('Invalid image URL'),
    alt: z.object({
      en: z.string().optional(),
      he: z.string().optional()
    }).optional(),
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
  tags: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  stockBySize: z.record(z.string(), z.number().int().min(0)).optional(),
  brand: z.string().optional(),
  subcategory: z.string().optional(),
  currency: z.string().optional()
})

// GET /api/products/[id] - Get a specific product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await productService.getProductById(id)
    
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

// PUT /api/products/[id] - Update a product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = productUpdateSchema.parse(body)

    // Check if product exists
    const existingProduct = await productService.getProductById(id)
    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check if SKU is being changed and if new SKU already exists
    if (validatedData.sku !== existingProduct.sku) {
      const existingProductBySku = await productService.getProductBySku(validatedData.sku)
      if (existingProductBySku && existingProductBySku.id !== id) {
        return NextResponse.json(
          { error: 'Product with this SKU already exists' },
          { status: 400 }
        )
      }
    }

    // Check if slugs are being changed and if new slugs already exist
    if (validatedData.slug.en !== existingProduct.slug?.en) {
      const existingProductByEnSlug = await productService.getProductBySlug(validatedData.slug.en, 'en')
      if (existingProductByEnSlug && existingProductByEnSlug.id !== id) {
        return NextResponse.json(
          { error: 'Product with this English slug already exists' },
          { status: 400 }
        )
      }
    }

    if (validatedData.slug.he !== existingProduct.slug?.he) {
      const existingProductByHeSlug = await productService.getProductBySlug(validatedData.slug.he, 'he')
      if (existingProductByHeSlug && existingProductByHeSlug.id !== id) {
        return NextResponse.json(
          { error: 'Product with this Hebrew slug already exists' },
          { status: 400 }
        )
      }
    }

    // Prepare product data for update - filter out undefined values
    const productData: any = {
      name: validatedData.name,
      slug: validatedData.slug,
      description: validatedData.description,
      price: validatedData.price,
      sku: validatedData.sku,
      stock: validatedData.stock,
      featured: validatedData.featured || false,
      isNew: validatedData.isNew || false,
      isActive: validatedData.isActive !== false,
      categoryId: validatedData.categoryId,
      updatedAt: new Date()
    }

    // Only add optional fields if they have values
    if (validatedData.salePrice && validatedData.salePrice > 0) {
      productData.salePrice = validatedData.salePrice
    }
    if (validatedData.saleStartDate && validatedData.saleStartDate !== null) {
      productData.saleStartDate = new Date(validatedData.saleStartDate)
    }
    if (validatedData.saleEndDate && validatedData.saleEndDate !== null) {
      productData.saleEndDate = new Date(validatedData.saleEndDate)
    }
    if (validatedData.images && validatedData.images.length > 0) {
      productData.images = validatedData.images.map((img, index) => ({
        url: img.url,
        alt: {
          en: img.alt?.en || `${validatedData.name.en} - Image ${index + 1}`,
          he: img.alt?.he || `${validatedData.name.he} - תמונה ${index + 1}`
        },
        isPrimary: img.isPrimary || index === 0,
        order: img.order || index,
        createdAt: new Date()
      }))
    }
    if (validatedData.variants && validatedData.variants.length > 0) {
      productData.variants = validatedData.variants.map(variant => ({
        size: variant.size,
        color: variant.color,
        stock: variant.stock,
        sku: variant.sku,
        price: variant.price,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
    }
    if (validatedData.tags && validatedData.tags.length > 0) {
      productData.tags = validatedData.tags
    }
    if (validatedData.colors && validatedData.colors.length > 0) {
      productData.colors = validatedData.colors
    }
    if (validatedData.sizes && validatedData.sizes.length > 0) {
      productData.sizes = validatedData.sizes
    }
    if (validatedData.stockBySize && Object.keys(validatedData.stockBySize).length > 0) {
      productData.stockBySize = validatedData.stockBySize
    }
    if (validatedData.brand) {
      productData.brand = validatedData.brand
    }
    if (validatedData.subcategory) {
      productData.subcategory = validatedData.subcategory
    }
    if (validatedData.currency) {
      productData.currency = validatedData.currency
    }

    // Remove any undefined values before sending to Firebase
    const cleanProductData = Object.fromEntries(
      Object.entries(productData).filter(([_, value]) => value !== undefined)
    )

    // Log the data being sent to Firebase for debugging
    console.log('Data being sent to Firebase:', JSON.stringify(cleanProductData, null, 2))
    
    // Check for any undefined values that might have slipped through
    const undefinedFields = Object.entries(cleanProductData).filter(([_, value]) => value === undefined)
    if (undefinedFields.length > 0) {
      console.error('Found undefined fields:', undefinedFields)
    }

    // Update product
    await productService.updateProduct(id, cleanProductData)

    // Get the updated product
    const updatedProduct = await productService.getProductById(id)

    return NextResponse.json(updatedProduct)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error details:', error.errors)
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    )
  }
}

// DELETE /api/products/[id] - Delete a product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Check if product exists
    const existingProduct = await productService.getProductById(id)
    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Delete product
    await productService.deleteProduct(id)

    return NextResponse.json({ message: 'Product deleted successfully' })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    )
  }
}