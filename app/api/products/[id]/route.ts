import { NextRequest, NextResponse } from 'next/server'
import { productService } from '@/lib/firebase'
import { z } from 'zod'

// Validation schema for updating products
const productUpdateSchema = z.object({
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
    priceOverride: z.coerce.number().positive().optional(),
    salePrice: z.coerce.number().positive().optional(),
    stockBySize: z.record(z.string(), z.coerce.number().int().min(0)),
    dimensions: z.object({
      heightCm: z.coerce.number().nullable().optional(),
      widthCm: z.coerce.number().nullable().optional(),
      depthCm: z.coerce.number().nullable().optional(),
      quantity: z.coerce.number().int().min(0).optional()
    }).optional(),
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

    // Prepare product data for update - filter out undefined values
    const productData: any = {
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
      currency: validatedData.currency,
      colorVariants: validatedData.colorVariants,
      isEnabled: validatedData.isEnabled,
      isDeleted: validatedData.isDeleted,
      newProduct: validatedData.newProduct,
      featuredProduct: validatedData.featuredProduct,
      materialCare: validatedData.materialCare,
      seo: validatedData.seo,
      searchKeywords: validatedData.searchKeywords || [],
      updatedAt: new Date()
    }

    // Only add optional fields if they have values
    if (validatedData.salePrice && validatedData.salePrice > 0) {
      productData.salePrice = validatedData.salePrice
    }

    // Clean dimensions data - remove undefined values from nested objects
    const cleanDimensions = (dimensions: any) => {
      if (!dimensions) return null;
      
      const cleaned = {
        heightCm: dimensions.heightCm ?? null,
        widthCm: dimensions.widthCm ?? null,
        depthCm: dimensions.depthCm ?? null,
        quantity: dimensions.quantity ?? undefined
      };
      
      // If all dimension values are null/undefined, return null
      if (cleaned.heightCm === null && cleaned.widthCm === null && cleaned.depthCm === null) {
        return null;
      }
      
      return cleaned;
    };

    // Deep clean function to remove undefined values recursively
    const deepClean = (obj: any): any => {
      if (obj === null || obj === undefined) return null;
      if (typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(deepClean);
      
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = deepClean(value);
        }
      }
      return cleaned;
    };

    // Clean colorVariants data
    const cleanedColorVariants: any = {};
    for (const [colorKey, variant] of Object.entries(productData.colorVariants)) {
      cleanedColorVariants[colorKey] = {
        ...variant,
        dimensions: cleanDimensions(variant.dimensions)
      };
    }
    
    productData.colorVariants = cleanedColorVariants;

    // Remove any undefined values before sending to Firebase
    const cleanProductData = deepClean(productData)

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