import { NextRequest, NextResponse } from 'next/server'
import { categoryService } from '@/lib/firebase'
import { z } from 'zod'

// Validation schema for creating/updating categories
const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().optional(),
  image: z.string().url('Invalid image URL').optional()
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
      image: validatedData.image
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