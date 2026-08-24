import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { categoryService } from '@/lib/firebase'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/server/auth'
import { revalidateNavigationCategories } from '@/lib/navigation-revalidate'
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
  // Accepted for backwards compatibility but ignored: position within a
  // sibling group is assigned on create and changed via
  // PATCH /api/admin/categories/reorder.
  sortOrder: z.number().min(0).optional()
})

// GET /api/categories - Get all categories
export async function GET() {
  try {
    const categories = await categoryService.getAllCategories()
    return NextResponse.json(categories)
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

// POST /api/categories - Create a new category
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    const validatedData = categorySchema.parse(body)

    // Create category
    const categoryData: any = {
      name: validatedData.name,
      slug: validatedData.slug,
      image: validatedData.image,
      parentId: validatedData.parentId,
      level: validatedData.level,
      isEnabled: validatedData.isEnabled,
      // No sortOrder: createCategory assigns it so a new category lands at the
      // end of its sibling group.
    }

    // Only include description if it's provided and has both en and he properties
    if (validatedData.description && validatedData.description.en && validatedData.description.he) {
      categoryData.description = validatedData.description
    }

    const categoryId = await categoryService.createCategory(categoryData)

    // Get the created category
    const categories = await categoryService.getAllCategories()
    const category = categories.find(c => c.id === categoryId)

    // Also create the category in Neon DB for synchronization.
    //
    // Mirrors the sortOrder Firestore actually assigned, not the one the
    // caller sent: createCategory computes its own via getNextSortOrder, so
    // echoing the request value here used to leave the mirror wrong from the
    // moment of creation.
    try {
      await prisma.category.create({
        data: {
          name_en: validatedData.name.en,
          name_he: validatedData.name.he,
          slug_en: validatedData.slug.en,
          slug_he: validatedData.slug.he,
          description: validatedData.description?.en || null,
          image: validatedData.image || null,
          isEnabled: validatedData.isEnabled,
          sortOrder: category?.sortOrder ?? 0,
          level: validatedData.level,
          parentId: validatedData.parentId || null,
        }
      })
      console.log(`Category "${validatedData.name.en}" created in both Firebase and Neon DB`)
    } catch (prismaError) {
      Sentry.captureException(prismaError);
      console.error('Failed to create category in Neon DB:', prismaError)
      // Don't fail the request if Neon DB creation fails, just log it
    }

    revalidateNavigationCategories()

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    Sentry.captureException(error);
    
    console.error('Error creating category:', error)
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    )
  }
} 