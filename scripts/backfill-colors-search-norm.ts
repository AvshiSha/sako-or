/**
 * Backfill colors_search_norm for all products from colorVariants JSON.
 * Run after migration: npx tsx scripts/backfill-colors-search-norm.ts
 */

import { extractColorsSearchNorm } from '../lib/hebrew-normalize'
import { createScriptPrisma } from './script-prisma'

const prisma = createScriptPrisma()

async function backfillColorsSearchNorm() {
  console.log('Backfilling colors_search_norm for all products...\n')

  const products = await prisma.product.findMany({
    select: { id: true, sku: true, colorVariants: true, colors_search_norm: true },
  })

  let updated = 0

  for (const product of products) {
    const colorsNorm = extractColorsSearchNorm(product.colorVariants)
    if (colorsNorm !== product.colors_search_norm) {
      await prisma.product.update({
        where: { id: product.id },
        data: { colors_search_norm: colorsNorm },
      })
      updated++
      console.log(`  Updated ${product.sku}: "${colorsNorm}"`)
    }
  }

  console.log(`\nDone. Updated ${updated}/${products.length} products.`)
}

backfillColorsSearchNorm()
  .catch((error) => {
    console.error('Backfill failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
