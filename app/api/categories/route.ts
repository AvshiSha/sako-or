import { NextRequest, NextResponse } from 'next/server'
import { categoryService } from '@/lib/firebase'
import { z } from 'zod'

// Validation schema for creating/updating categories
const categorySchema = z.object({
  name: z.object({
    en: z.string().min(1, 'English name is required'),
    he: z.string().min(1, 'Hebrew name is required')
  }),
  slug: z.object({
    en: z.string().min(1, 'English slug is required'),
    he: z.string().min(1, 'Hebrew slug is required')
  }),
  description: z.object({
    en: z.string().optional(),
    he: z.string().optional()
  }).optional(),
  image: z.string().url('Invalid image URL').optional(),
  parentId: z.string().optional(),
  level: z.number().min(0).max(2),
  isEnabled: z.boolean().default(true),
  sortOrder: z.number().min(0)
})

// GET /api/categories - Get all categories
export async function GET() {
  try {
    const categories = await categoryService.getAllCategories()
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

// POST /api/categories - Create a new category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = categorySchema.parse(body)

    // Create category
    const categoryId = await categoryService.createCategory({
      name: validatedData.name,
      slug: validatedData.slug,
      description: validatedData.description,
      image: validatedData.image,
      parentId: validatedData.parentId,
      level: validatedData.level,
      isEnabled: validatedData.isEnabled,
      sortOrder: validatedData.sortOrder
    })

    // Get the created category
    const categories = await categoryService.getAllCategories()
    const category = categories.find(c => c.id === categoryId)

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Error creating category:', error)
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    )
  }
} 