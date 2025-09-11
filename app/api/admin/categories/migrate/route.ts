import { NextRequest, NextResponse } from 'next/server'
import { categoryService } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    // Get all categories
    const allCategories = await categoryService.getAllCategories()
    
    // Filter categories that need migration (missing new fields)
    const categoriesToMigrate = allCategories.filter(cat => 
      cat.level === undefined || 
      cat.isEnabled === undefined || 
      cat.sortOrder === undefined
    )
    
    if (categoriesToMigrate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All categories are already migrated!',
        migratedCount: 0
      })
    }
    
    // Migrate categories
    let migratedCount = 0
    
    for (const category of categoriesToMigrate) {
      const updateData = {
        level: 0, // Set all existing categories as main categories
        isEnabled: true, // Enable all existing categories
        sortOrder: migratedCount, // Set sort order based on current order
        updatedAt: new Date()
      }
      
      if (category.id) {
        await categoryService.updateCategory(category.id, updateData)
        migratedCount++
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${migratedCount} categories!`,
      migratedCount,
      totalFound: categoriesToMigrate.length
    })
    
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to migrate categories',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get all categories
    const allCategories = await categoryService.getAllCategories()
    
    // Filter categories that need migration
    const categoriesToMigrate = allCategories.filter(cat => 
      cat.level === undefined || 
      cat.isEnabled === undefined || 
      cat.sortOrder === undefined
    )
    
    return NextResponse.json({
      success: true,
      totalCategories: allCategories.length,
      categoriesToMigrate: categoriesToMigrate.length,
      categories: categoriesToMigrate.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description
      }))
    })
    
  } catch (error) {
    console.error('Error checking categories:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check categories',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
