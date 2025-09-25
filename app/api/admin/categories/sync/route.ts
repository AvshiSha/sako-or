import { NextRequest, NextResponse } from 'next/server'
import { categoryService } from '@/lib/firebase'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting category synchronization from Firebase to Neon DB...')
    
    // Get all categories from Firebase
    const firebaseCategories = await categoryService.getAllCategories()
    console.log(`Found ${firebaseCategories.length} categories in Firebase`)
    
    let syncedCount = 0
    let createdCount = 0
    let updatedCount = 0
    let deletedCount = 0
    const errors: string[] = []
    
    // Sort categories by level to ensure parents are created before children
    const sortedCategories = firebaseCategories.sort((a, b) => (a.level || 0) - (b.level || 0))
    
    // Map to track Firebase ID to Neon DB ID mapping
    const firebaseToNeonIdMap = new Map<string, string>()
    
    // Get all existing categories in Neon DB
    const existingNeonCategories = await prisma.category.findMany()
    const firebaseCategoryNames = new Set(
      sortedCategories.map(cat => 
        typeof cat.name === 'object' ? cat.name.en : cat.name
      )
    )
    
    // Delete categories that exist in Neon DB but not in Firebase
    for (const neonCategory of existingNeonCategories) {
      if (!firebaseCategoryNames.has(neonCategory.name_en)) {
        try {
          await prisma.category.delete({
            where: { id: neonCategory.id }
          })
          deletedCount++
          console.log(`Deleted category: ${neonCategory.name_en}`)
        } catch (error) {
          const errorMsg = `Failed to delete category "${neonCategory.name_en}": ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(errorMsg)
          errors.push(errorMsg)
        }
      }
    }
    
    for (const firebaseCategory of sortedCategories) {
      try {
        // Extract category data, handling both old and new Firebase structures
        const categoryName = typeof firebaseCategory.name === 'object' 
          ? firebaseCategory.name.en 
          : firebaseCategory.name || 'Unnamed Category'
          
        const categorySlug = typeof firebaseCategory.slug === 'object' 
          ? firebaseCategory.slug.en 
          : firebaseCategory.slug || categoryName.toLowerCase().replace(/\s+/g, '-')
          
        const categoryDescription = typeof firebaseCategory.description === 'object' 
          ? firebaseCategory.description?.en 
          : firebaseCategory.description

        // Check if category already exists in Neon DB by name_en
        const existingCategory = await prisma.category.findFirst({
          where: { name_en: categoryName }
        })

        // Map parentId from Firebase to Neon DB
        let parentId = null
        if (firebaseCategory.parentId && firebaseToNeonIdMap.has(firebaseCategory.parentId)) {
          parentId = firebaseToNeonIdMap.get(firebaseCategory.parentId)!
        }

        const categoryData = {
          name_en: categoryName,
          name_he: typeof firebaseCategory.name === 'object' ? firebaseCategory.name.he : categoryName,
          slug_en: categorySlug,
          slug_he: typeof firebaseCategory.slug === 'object' ? firebaseCategory.slug.he : categorySlug,
          description: categoryDescription || null,
          image: firebaseCategory.image || null,
          isEnabled: firebaseCategory.isEnabled !== undefined ? firebaseCategory.isEnabled : true,
          sortOrder: firebaseCategory.sortOrder || 0,
          level: firebaseCategory.level || 0,
          parentId: parentId,
        }

        if (existingCategory) {
          // Update existing category
          await prisma.category.update({
            where: { id: existingCategory.id },
            data: categoryData
          })
          // Store the mapping for child categories
          if (firebaseCategory.id) {
            firebaseToNeonIdMap.set(firebaseCategory.id, existingCategory.id)
          }
          updatedCount++
          console.log(`Updated category: ${categoryName}`)
        } else {
          // Create new category
          const newCategory = await prisma.category.create({
            data: categoryData
          })
          // Store the mapping for child categories
          if (firebaseCategory.id) {
            firebaseToNeonIdMap.set(firebaseCategory.id, newCategory.id)
          }
          createdCount++
          console.log(`Created category: ${categoryName}`)
        }
        
        syncedCount++
      } catch (error) {
        const errorMsg = `Failed to sync category "${firebaseCategory.name}": ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }
    
    const result = {
      success: true,
      message: `Successfully synchronized ${syncedCount} categories`,
      stats: {
        total: firebaseCategories.length,
        synced: syncedCount,
        created: createdCount,
        updated: updatedCount,
        deleted: deletedCount,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    }
    
    console.log('Category synchronization completed:', result)
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Category synchronization error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to synchronize categories',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get categories from both Firebase and Neon DB for comparison
    const firebaseCategories = await categoryService.getAllCategories()
    const neonCategories = await prisma.category.findMany({
      orderBy: { name_en: 'asc' }
    })
    
    // Compare categories
    const firebaseNames = firebaseCategories.map(cat => 
      typeof cat.name === 'object' ? cat.name.en : cat.name
    )
    const neonNames = neonCategories.map(cat => cat.name_en)
    
    const missingInNeon = firebaseNames.filter(name => !neonNames.includes(name))
    const extraInNeon = neonNames.filter(name => !firebaseNames.includes(name))
    
    return NextResponse.json({
      success: true,
      comparison: {
        firebase: {
          count: firebaseCategories.length,
          categories: firebaseNames
        },
        neon: {
          count: neonCategories.length,
          categories: neonNames
        },
        differences: {
          missingInNeon,
          extraInNeon,
          needsSync: missingInNeon.length > 0 || extraInNeon.length > 0
        }
      }
    })
    
  } catch (error) {
    console.error('Error comparing categories:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to compare categories',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
