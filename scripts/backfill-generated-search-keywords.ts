/**
 * Backfill generated_search_keywords and colors_search_norm for all products.
 * Run after migration: npx tsx scripts/backfill-generated-search-keywords.ts
 */

import { buildProductSearchDerivedFields } from '../lib/build-product-search-keywords'
import { createScriptPrisma } from './script-prisma'

const prisma = createScriptPrisma()

async function backfillGeneratedSearchKeywords() {
  console.log('Backfilling generated search keywords...\n')

  const products = await prisma.product.findMany({
    select: {
      id: true,
      sku: true,
      title_he: true,
      title_en: true,
      category: true,
      subCategory: true,
      subSubCategory: true,
      category_he: true,
      subCategory_he: true,
      subSubCategory_he: true,
      brand: true,
      tags: true,
      upperMaterial_he: true,
      lining_he: true,
      sole_he: true,
      colorVariants: true,
      generated_search_keywords: true,
      colors_search_norm: true,
    },
  })

  let updated = 0

  for (const product of products) {
    const derived = buildProductSearchDerivedFields({
      title_he: product.title_he,
      title_en: product.title_en,
      category: product.category,
      subCategory: product.subCategory,
      subSubCategory: product.subSubCategory,
      category_he: product.category_he,
      subCategory_he: product.subCategory_he,
      subSubCategory_he: product.subSubCategory_he,
      brand: product.brand,
      tags: product.tags,
      upperMaterial_he: product.upperMaterial_he,
      lining_he: product.lining_he,
      sole_he: product.sole_he,
      colorVariants: product.colorVariants,
    })

    const keywordsChanged =
      JSON.stringify(product.generated_search_keywords) !==
      JSON.stringify(derived.generated_search_keywords)
    const colorsChanged = product.colors_search_norm !== derived.colors_search_norm

    if (keywordsChanged || colorsChanged) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          generated_search_keywords: derived.generated_search_keywords,
          colors_search_norm: derived.colors_search_norm,
        },
      })
      updated++
      console.log(
        `  ${product.sku}: ${derived.generated_search_keywords.length} keywords, colors="${derived.colors_search_norm.slice(0, 60)}${derived.colors_search_norm.length > 60 ? '...' : ''}"`
      )
    }
  }

  console.log(`\nDone. Updated ${updated}/${products.length} products.`)
}

backfillGeneratedSearchKeywords()
  .catch((error) => {
    console.error('Backfill failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
