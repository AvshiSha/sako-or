/**
 * Script to backfill Hebrew category fields for existing products
 * This resolves category paths and populates category_he, subCategory_he, subSubCategory_he
 */

import { prisma } from '../lib/prisma'
import { categoryService } from '../lib/firebase'

async function backfillHebrewCategories() {
  try {
    console.log('🔄 Starting Hebrew category backfill...\n')
    
    // Get all Firebase categories
    const firebaseCategories = await categoryService.getAllCategories()
    console.log(`Found ${firebaseCategories.length} Firebase categories`)
    
    // Create mapping from Firebase category IDs to category objects
    const firebaseCategoryMap = new Map<string, { en: string; he: string; level?: number; parentId?: string }>()
    firebaseCategories.forEach(cat => {
      if (cat.id) {
        const categoryNameEn = typeof cat.name === 'object' ? cat.name.en : cat.name
        const categoryNameHe = typeof cat.name === 'object' ? cat.name.he : cat.name
        firebaseCategoryMap.set(cat.id, {
          en: categoryNameEn,
          he: categoryNameHe,
          level: cat.level,
          parentId: cat.parentId
        })
      }
    })

    // Get all products from Neon DB
    const products = await prisma.product.findMany({
      select: {
        id: true,
        sku: true,
        title_en: true,
        categories_path_id: true,
        category: true,
        subCategory: true,
        subSubCategory: true
      }
    })

    console.log(`Found ${products.length} products to process\n`)

    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const product of products) {
      try {
        let categoryEn = null
        let categoryHe = null
        let subCategoryEn = null
        let subCategoryHe = null
        let subSubCategoryEn = null
        let subSubCategoryHe = null

        // Resolve category path using categories_path_id array
        if (product.categories_path_id && Array.isArray(product.categories_path_id) && product.categories_path_id.length > 0) {
          const resolvedPath = product.categories_path_id.map((firebaseId: string) => {
            const firebaseCat = firebaseCategoryMap.get(firebaseId)
            return firebaseCat ? {
              en: firebaseCat.en,
              he: firebaseCat.he,
              level: firebaseCat.level,
              parentId: firebaseCat.parentId
            } : null
          }).filter(Boolean)

          if (resolvedPath.length > 0) {
            categoryEn = resolvedPath[0].en
            categoryHe = resolvedPath[0].he

            // Look up main category in Neon DB
            const mainCategory = await prisma.category.findFirst({
              where: { name_en: categoryEn, level: 0 }
            })

            if (resolvedPath.length > 1) {
              subCategoryEn = resolvedPath[1].en
              // Look up Hebrew name from Neon DB with parent matching
              const subCategory = await prisma.category.findFirst({
                where: {
                  name_en: subCategoryEn,
                  level: 1,
                  parentId: mainCategory?.id || undefined
                }
              })
              subCategoryHe = subCategory?.name_he || resolvedPath[1].he
            }

            if (resolvedPath.length > 2) {
              subSubCategoryEn = resolvedPath[2].en
              // Look up Hebrew name from Neon DB with parent matching
              const subCategoryForLookup = await prisma.category.findFirst({
                where: {
                  name_en: subCategoryEn,
                  level: 1,
                  parentId: mainCategory?.id || undefined
                }
              })
              const subSubCategory = await prisma.category.findFirst({
                where: {
                  name_en: subSubCategoryEn,
                  level: 2,
                  parentId: subCategoryForLookup?.id || undefined
                }
              })
              subSubCategoryHe = subSubCategory?.name_he || resolvedPath[2].he
            }
          }
        }

        // Update product with Hebrew category fields
        // Also update English fields if they're still Firebase IDs
        const updateData: any = {}
        
        if (categoryHe) {
          updateData.category_he = categoryHe
          if (categoryEn && categoryEn !== product.category) {
            updateData.category = categoryEn
          }
        }
        
        if (subCategoryHe) {
          updateData.subCategory_he = subCategoryHe
          if (subCategoryEn && subCategoryEn !== product.subCategory) {
            updateData.subCategory = subCategoryEn
          }
        }
        
        if (subSubCategoryHe) {
          updateData.subSubCategory_he = subSubCategoryHe
          if (subSubCategoryEn && subSubCategoryEn !== product.subSubCategory) {
            updateData.subSubCategory = subSubCategoryEn
          }
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.product.update({
            where: { id: product.id },
            data: updateData
          })
          updated++
          
          if (updated % 10 === 0) {
            console.log(`Updated ${updated}/${products.length} products...`)
          }
        } else {
          skipped++
        }

      } catch (error) {
        const errorMsg = `Failed to update product ${product.sku}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }

    console.log(`\n✅ Backfill complete!`)
    console.log(`   Updated: ${updated} products`)
    console.log(`   Skipped: ${skipped} products`)
    if (errors.length > 0) {
      console.log(`   Errors: ${errors.length}`)
      errors.slice(0, 10).forEach(err => console.log(`     - ${err}`))
      if (errors.length > 10) {
        console.log(`     ... and ${errors.length - 10} more errors`)
      }
    }

  } catch (error) {
    console.error('Error during backfill:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

backfillHebrewCategories()
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Failed:', error)
    process.exit(1)
  })

