/**
 * Test script to check if search_vector is properly indexing Hebrew category names
 */

import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

async function testSearchVector() {
  try {
    console.log('🔍 Testing search_vector for Hebrew category names...\n')
    
    // Find a product with "נעלי סירה" in subSubCategory_he
    const pumpsProduct = await prisma.product.findFirst({
      where: {
        subSubCategory_he: {
          contains: 'נעלי סירה'
        },
        isActive: true,
        isDeleted: false
      },
      select: {
        sku: true,
        title_he: true,
        subSubCategory_he: true,
        subSubCategory: true
      }
    })
    
    if (!pumpsProduct) {
      console.log('❌ No product found with subSubCategory_he containing "נעלי סירה"')
      console.log('   This might be the issue - products may not have Hebrew category names populated')
      return
    }
    
    console.log('✅ Found product with "נעלי סירה":')
    console.log(`   SKU: ${pumpsProduct.sku}`)
    console.log(`   Title: ${pumpsProduct.title_he}`)
    console.log(`   Category (HE): ${pumpsProduct.subSubCategory_he}`)
    console.log(`   Category (EN): ${pumpsProduct.subSubCategory}\n`)
    
    // Check the search_vector for this product
    const searchVectorCheck = await prisma.$queryRaw<Array<{
      sku: string
      subSubCategory_he: string | null
      search_vector_text: string
      has_naali: boolean
      has_sira: boolean
      has_naali_sira: boolean
    }>>(Prisma.sql`
      SELECT 
        p.sku,
        p."subSubCategory_he",
        p.search_vector::text AS search_vector_text,
        p.search_vector @@ to_tsquery('simple', 'נעלי') AS has_naali,
        p.search_vector @@ to_tsquery('simple', 'סירה') AS has_sira,
        p.search_vector @@ to_tsquery('simple', 'נעלי & סירה') AS has_naali_sira
      FROM products p
      WHERE p.sku = ${pumpsProduct.sku}
    `)
    
    if (searchVectorCheck.length > 0) {
      const result = searchVectorCheck[0]
      console.log('📊 Search Vector Analysis:')
      console.log(`   Has "נעלי": ${result.has_naali}`)
      console.log(`   Has "סירה": ${result.has_sira}`)
      console.log(`   Has "נעלי & סירה" (both): ${result.has_naali_sira}`)
      console.log(`   Search Vector Preview: ${result.search_vector_text?.substring(0, 200)}...\n`)
    }
    
    // Test the actual search query
    const searchQuery = 'נעלי סירה מידה 37'
    console.log(`🔎 Testing search query: "${searchQuery}"\n`)
    
    const searchResults = await prisma.$queryRaw<Array<{
      sku: string
      title_he: string
      subSubCategory_he: string | null
      subSubCategory: string | null
      fts_match: boolean
      category_match: boolean
      size_match: boolean
      rank: number
    }>>(Prisma.sql`
      SELECT 
        p.sku,
        p."title_he",
        p."subSubCategory_he",
        p."subSubCategory",
        p.search_vector @@ websearch_to_tsquery('simple', ${searchQuery}) AS fts_match,
        (
          p."subSubCategory_he" ILIKE '%נעלי סירה%'
          OR p."subCategory_he" ILIKE '%נעלי סירה%'
          OR p."category_he" ILIKE '%נעלי סירה%'
        ) AS category_match,
        EXISTS (
          SELECT 1
          FROM jsonb_each(p."colorVariants") AS variant(color_slug, variant_data),
               jsonb_each(variant_data->'stockBySize') AS size_entry(size_key, stock_value)
          WHERE size_key = '37'
            AND (stock_value::text)::int > 0
        ) AS size_match,
        (
          CASE 
            WHEN p.search_vector @@ websearch_to_tsquery('simple', ${searchQuery})
            THEN ts_rank(p.search_vector, websearch_to_tsquery('simple', ${searchQuery})) * 1000
            ELSE 0
          END
          +
          CASE 
            WHEN (
              p."subSubCategory_he" ILIKE '%נעלי סירה%'
              OR p."subCategory_he" ILIKE '%נעלי סירה%'
              OR p."category_he" ILIKE '%נעלי סירה%'
            )
            THEN 800
            ELSE 0
          END
          +
          CASE 
            WHEN EXISTS (
              SELECT 1
              FROM jsonb_each(p."colorVariants") AS variant(color_slug, variant_data),
                   jsonb_each(variant_data->'stockBySize') AS size_entry(size_key, stock_value)
              WHERE size_key = '37'
                AND (stock_value::text)::int > 0
            )
            THEN 20
            ELSE 0
          END
        ) AS rank
      FROM products p
      WHERE (
        p.search_vector @@ websearch_to_tsquery('simple', ${searchQuery})
        OR
        EXISTS (
          SELECT 1
          FROM jsonb_each(p."colorVariants") AS variant(color_slug, variant_data),
               jsonb_each(variant_data->'stockBySize') AS size_entry(size_key, stock_value)
          WHERE size_key = '37'
            AND (stock_value::text)::int > 0
        )
      )
        AND p."isActive" = true
        AND p."isDeleted" = false
      ORDER BY rank DESC
      LIMIT 10
    `)
    
    console.log(`📋 Top 10 Results:\n`)
    searchResults.forEach((product, idx) => {
      console.log(`${idx + 1}. ${product.sku} - ${product.title_he}`)
      console.log(`   Category: ${product.subSubCategory_he || product.subSubCategory || 'N/A'}`)
      console.log(`   FTS Match: ${product.fts_match}`)
      console.log(`   Category Match: ${product.category_match}`)
      console.log(`   Size Match: ${product.size_match}`)
      console.log(`   Rank: ${product.rank}`)
      console.log('')
    })
    
    // Check if boots are ranking higher than pumps
    const pumpsCount = searchResults.filter(p => 
      p.subSubCategory_he?.includes('נעלי סירה') || 
      p.subSubCategory?.toLowerCase().includes('pumps')
    ).length
    
    const bootsCount = searchResults.filter(p => 
      p.subSubCategory_he?.includes('מגפ') || 
      p.subSubCategory?.toLowerCase().includes('boots')
    ).length
    
    console.log(`\n📊 Summary:`)
    console.log(`   Pumps in top 10: ${pumpsCount}`)
    console.log(`   Boots in top 10: ${bootsCount}`)
    
    if (bootsCount > pumpsCount && pumpsCount === 0) {
      console.log(`\n⚠️  ISSUE: Boots are ranking higher than pumps!`)
      console.log(`   This suggests the search_vector or ranking needs adjustment.`)
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testSearchVector()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error)
    process.exit(1)
  })


