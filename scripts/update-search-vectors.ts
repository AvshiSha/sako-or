/**
 * Script to update search_vector for existing products
 * Run this after the migration to populate search_vector for products created before the migration
 */

import { prisma } from '../lib/prisma'

async function updateSearchVectors() {
  try {
    console.log('Updating search_vector for all products...')
    
    // The search_vector is a generated column, so we need to trigger an update
    // by updating a field that will cause the generated column to recalculate
    const products = await prisma.product.findMany({
      select: {
        id: true,
        sku: true,
        title_en: true
      }
    })

    console.log(`Found ${products.length} products to update`)

    let updated = 0
    for (const product of products) {
      // Trigger update by updating updatedAt (this will cause search_vector to recalculate)
      await prisma.product.update({
        where: { id: product.id },
        data: {
          updatedAt: new Date()
        }
      })
      updated++
      
      if (updated % 10 === 0) {
        console.log(`Updated ${updated}/${products.length} products...`)
      }
    }

    console.log(`✅ Successfully updated ${updated} products`)
    
    // Verify search_vector is populated
    const checkResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::int AS count
      FROM products
      WHERE search_vector IS NOT NULL
    `
    
    const populatedCount = Number(checkResult[0]?.count || 0)
    console.log(`✅ ${populatedCount}/${products.length} products have search_vector populated`)
    
  } catch (error) {
    console.error('Error updating search vectors:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

updateSearchVectors()
  .then(() => {
    console.log('Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Failed:', error)
    process.exit(1)
  })

