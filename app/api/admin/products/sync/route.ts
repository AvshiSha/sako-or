import { NextRequest, NextResponse } from 'next/server'
import { productService, categoryService } from '@/lib/firebase'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting product synchronization from Firebase to Neon DB...')
    
    // Get all products and categories from Firebase
    const firebaseProducts = await productService.getAllProducts()
    const firebaseCategories = await categoryService.getAllCategories()
    console.log(`Found ${firebaseProducts.length} products in Firebase`)
    
    // Create a mapping from Firebase category IDs to category names
    const firebaseCategoryMap = new Map<string, string>()
    firebaseCategories.forEach(cat => {
      if (cat.id) {
        const categoryName = typeof cat.name === 'object' ? cat.name.en : cat.name
        firebaseCategoryMap.set(cat.id, categoryName)
      }
    })
    
    let syncedCount = 0
    let createdCount = 0
    let updatedCount = 0
    let deletedCount = 0
    const errors: string[] = []
    
    // Get all existing products in Neon DB
    const existingNeonProducts = await prisma.product.findMany()
    const firebaseProductSkus = new Set(
      firebaseProducts.map(product => product.sku || product.baseSku || '')
    )
    
    // Delete products that exist in Neon DB but not in Firebase
    for (const neonProduct of existingNeonProducts) {
      if (!firebaseProductSkus.has(neonProduct.sku)) {
        try {
          await prisma.product.delete({
            where: { id: neonProduct.id }
          })
          deletedCount++
          console.log(`Deleted product: ${neonProduct.title_en}`)
        } catch (error) {
          const errorMsg = `Failed to delete product "${neonProduct.title_en}": ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(errorMsg)
          errors.push(errorMsg)
        }
      }
    }
    
    for (const firebaseProduct of firebaseProducts) {
      try {
        // Extract product data, handling both old and new Firebase structures
        const productSku = firebaseProduct.sku || firebaseProduct.baseSku || ''
        const productTitleEn = firebaseProduct.title_en || (typeof firebaseProduct.name === 'object' ? firebaseProduct.name?.en : firebaseProduct.name) || 'Unnamed Product'
        const productTitleHe = firebaseProduct.title_he || (typeof firebaseProduct.name === 'object' ? firebaseProduct.name?.he : firebaseProduct.name) || productTitleEn
        const productDescEn = firebaseProduct.description_en || (typeof firebaseProduct.description === 'object' ? firebaseProduct.description?.en : firebaseProduct.description) || ''
        const productDescHe = firebaseProduct.description_he || (typeof firebaseProduct.description === 'object' ? firebaseProduct.description?.he : firebaseProduct.description) || productDescEn

        // Debug logging for new product field
        console.log(`Product "${productTitleEn}" - isNew: ${firebaseProduct.isNew}, newProduct: ${(firebaseProduct as any).newProduct}`)

        // Check if product already exists in Neon DB by SKU
        const existingProduct = await prisma.product.findFirst({
          where: { sku: productSku }
        })

        // Find category by Firebase ID (since products store Firebase category IDs)
        let categoryId = null
        if (firebaseProduct.category) {
          // Use the pre-built mapping to get category name
          const categoryName = firebaseCategoryMap.get(firebaseProduct.category)
          
          if (categoryName) {
            const category = await prisma.category.findFirst({
              where: { name_en: categoryName }
            })
            
            if (category) {
              categoryId = category.id
              console.log(`Mapped Firebase category "${firebaseProduct.category}" (${categoryName}) to Neon DB category ID: ${categoryId}`)
            } else {
              console.warn(`Category "${categoryName}" not found in Neon DB for product "${productTitleEn}"`)
            }
          } else {
            console.warn(`Firebase category ID "${firebaseProduct.category}" not found in category mapping for product "${productTitleEn}"`)
          }
        }

        // Skip products without a valid category
        if (!categoryId && firebaseProduct.category) {
          const errorMsg = `Skipping product "${productTitleEn}" - category "${firebaseProduct.category}" not found in Neon DB`
          console.warn(errorMsg)
          errors.push(errorMsg)
          continue
        }

        const productData = {
          title_en: productTitleEn,
          title_he: productTitleHe,
          description_en: productDescEn,
          description_he: productDescHe,
          sku: productSku,
          brand: firebaseProduct.brand || '',
          price: firebaseProduct.price || 0,
          salePrice: firebaseProduct.salePrice || null,
          currency: firebaseProduct.currency || 'ILS',
          category: firebaseProduct.category || '',
          subCategory: firebaseProduct.subCategory || null,
          subSubCategory: firebaseProduct.subSubCategory || null,
          categories_path: firebaseProduct.categories_path || [],
          categories_path_id: firebaseProduct.categories_path_id || [],
          categoryId: categoryId || '',
          isEnabled: firebaseProduct.isEnabled !== undefined ? firebaseProduct.isEnabled : true,
          isDeleted: firebaseProduct.isDeleted !== undefined ? firebaseProduct.isDeleted : false,
          featured: firebaseProduct.featured !== undefined ? firebaseProduct.featured : false,
          isNew: firebaseProduct.isNew !== undefined ? firebaseProduct.isNew : (firebaseProduct as any).newProduct !== undefined ? (firebaseProduct as any).newProduct : false,
          isActive: firebaseProduct.isActive !== undefined ? firebaseProduct.isActive : true,
          // SEO fields
          seo_title_en: firebaseProduct.seo?.title_en || null,
          seo_title_he: firebaseProduct.seo?.title_he || null,
          seo_description_en: firebaseProduct.seo?.description_en || null,
          seo_description_he: firebaseProduct.seo?.description_he || null,
          seo_slug: firebaseProduct.seo?.slug || null,
          searchKeywords: firebaseProduct.searchKeywords || [],
          // Material & Care fields (from materialCare object)
          upperMaterial_en: (firebaseProduct as any).materialCare?.upperMaterial_en || null,
          upperMaterial_he: (firebaseProduct as any).materialCare?.upperMaterial_he || null,
          materialInnerSole_en: (firebaseProduct as any).materialCare?.materialInnerSole_en || null,
          materialInnerSole_he: (firebaseProduct as any).materialCare?.materialInnerSole_he || null,
          lining_en: (firebaseProduct as any).materialCare?.lining_en || null,
          lining_he: (firebaseProduct as any).materialCare?.lining_he || null,
          sole_en: (firebaseProduct as any).materialCare?.sole_en || null,
          sole_he: (firebaseProduct as any).materialCare?.sole_he || null,
          heelHeight_en: (firebaseProduct as any).materialCare?.heelHeight_en || null,
          heelHeight_he: (firebaseProduct as any).materialCare?.heelHeight_he || null,
          shippingReturns_en: (firebaseProduct as any).materialCare?.shippingReturns_en || null,
          shippingReturns_he: (firebaseProduct as any).materialCare?.shippingReturns_he || null,
        }

        if (existingProduct) {
          // Update existing product
          await prisma.product.update({
            where: { id: existingProduct.id },
            data: productData
          })
          updatedCount++
          console.log(`Updated product: ${productTitleEn}`)
        } else {
          // Create new product
          await prisma.product.create({
            data: productData
          })
          createdCount++
          console.log(`Created product: ${productTitleEn}`)
        }
        
        syncedCount++
      } catch (error) {
        const errorMsg = `Failed to sync product "${firebaseProduct.title_en || firebaseProduct.name}": ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }
    
    const result = {
      success: true,
      message: `Successfully synchronized ${syncedCount} products`,
      stats: {
        total: firebaseProducts.length,
        synced: syncedCount,
        created: createdCount,
        updated: updatedCount,
        deleted: deletedCount,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    }
    
    console.log('Product synchronization completed:', result)
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Product synchronization error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to synchronize products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get products from both Firebase and Neon DB for comparison
    const firebaseProducts = await productService.getAllProducts()
    const neonProducts = await prisma.product.findMany({
      orderBy: { title_en: 'asc' }
    })
    
    // Compare products
    const firebaseSkus = firebaseProducts.map(product => product.sku || product.baseSku || '')
    const neonSkus = neonProducts.map(product => product.sku)
    
    const missingInNeon = firebaseSkus.filter(sku => !neonSkus.includes(sku))
    const extraInNeon = neonSkus.filter(sku => !firebaseSkus.includes(sku))
    
    return NextResponse.json({
      success: true,
      comparison: {
        firebase: {
          count: firebaseProducts.length,
          products: firebaseSkus
        },
        neon: {
          count: neonProducts.length,
          products: neonSkus
        },
        differences: {
          missingInNeon,
          extraInNeon,
          needsSync: missingInNeon.length > 0 || extraInNeon.length > 0
        }
      }
    })
    
  } catch (error) {
    console.error('Error comparing products:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to compare products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
