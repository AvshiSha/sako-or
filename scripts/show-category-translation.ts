/**
 * Script to show how category translation will work
 * This demonstrates the mapping from English category names to Hebrew
 */

import { prisma } from '../lib/prisma'

async function showCategoryTranslation() {
  try {
    console.log('📋 Category Translation Mapping\n')
    console.log('=' .repeat(60))
    
    // Get all categories from database
    const categories = await prisma.category.findMany({
      orderBy: [
        { level: 'asc' },
        { sortOrder: 'asc' }
      ]
    })

    // Group by level
    const mainCategories = categories.filter(c => c.level === 0)
    const subCategories = categories.filter(c => c.level === 1)
    const subSubCategories = categories.filter(c => c.level === 2)

    console.log('\n🔹 MAIN CATEGORIES (Level 0):')
    console.log('-'.repeat(60))
    mainCategories.forEach(cat => {
      console.log(`  ${cat.name_en.padEnd(25)} → ${cat.name_he}`)
    })

    console.log('\n🔹 SUB CATEGORIES (Level 1):')
    console.log('-'.repeat(60))
    subCategories.forEach(cat => {
      const parent = categories.find(c => c.id === cat.parentId)
      console.log(`  ${cat.name_en.padEnd(25)} → ${cat.name_he} ${parent ? `(under ${parent.name_en})` : ''}`)
    })

    console.log('\n🔹 SUB-SUB CATEGORIES (Level 2):')
    console.log('-'.repeat(60))
    subSubCategories.forEach(cat => {
      const parent = categories.find(c => c.id === cat.parentId)
      const grandparent = parent ? categories.find(c => c.id === parent.parentId) : null
      console.log(`  ${cat.name_en.padEnd(25)} → ${cat.name_he} ${parent ? `(under ${parent.name_en})` : ''}`)
    })

    // Show example products and how they would be translated
    console.log('\n\n📦 EXAMPLE PRODUCT TRANSLATION:')
    console.log('='.repeat(60))
    
    const sampleProducts = await prisma.product.findMany({
      take: 5,
      select: {
        sku: true,
        category: true,
        subCategory: true,
        subSubCategory: true,
        categoryId: true
      }
    })

    for (const product of sampleProducts) {
      console.log(`\nProduct SKU: ${product.sku}`)
      console.log(`  Current (EN): category="${product.category}", subCategory="${product.subCategory || 'N/A'}", subSubCategory="${product.subSubCategory || 'N/A'}"`)
      
      // Find Hebrew translations
      let categoryHe = null
      let subCategoryHe = null
      let subSubCategoryHe = null

      if (product.category) {
        const cat = categories.find(c => c.name_en === product.category)
        if (cat) categoryHe = cat.name_he
      }

      if (product.subCategory) {
        const cat = categories.find(c => c.name_en === product.subCategory)
        if (cat) subCategoryHe = cat.name_he
      }

      if (product.subSubCategory) {
        const cat = categories.find(c => c.name_en === product.subSubCategory)
        if (cat) subSubCategoryHe = cat.name_he
      }

      console.log(`  Translated (HE): category_he="${categoryHe || 'NOT FOUND'}", subCategory_he="${subCategoryHe || 'N/A'}", subSubCategory_he="${subSubCategoryHe || 'N/A'}"`)
    }

    // Show translation logic
    console.log('\n\n🔧 TRANSLATION LOGIC:')
    console.log('='.repeat(60))
    console.log(`
When syncing products, for each product:

1. Look up category by name_en:
   const category = await prisma.category.findFirst({
     where: { name_en: product.category }
   })
   product.category_he = category?.name_he || null

2. Look up subCategory by name_en:
   if (product.subCategory) {
     const subCat = await prisma.category.findFirst({
       where: { name_en: product.subCategory }
     })
     product.subCategory_he = subCat?.name_he || null
   }

3. Look up subSubCategory by name_en:
   if (product.subSubCategory) {
     const subSubCat = await prisma.category.findFirst({
       where: { name_en: product.subSubCategory }
     })
     product.subSubCategory_he = subSubCat?.name_he || null
   }
    `)

    console.log('\n✅ This will allow Hebrew searches like "נעלי סירה" to find products!')
    
  } catch (error) {
    console.error('Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

showCategoryTranslation()
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Failed:', error)
    process.exit(1)
  })

