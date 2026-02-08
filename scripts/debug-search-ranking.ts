/**
 * Debug script to check why category matches aren't ranking higher
 */

import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

async function debugSearchRanking() {
  try {
    const searchQuery = 'נעלי סירה מידה 37'
    
    // Extract size numbers
    const sizeMatch = searchQuery.match(/\b(\d{2,3})\b/);
    const sizeNumbers = sizeMatch ? [sizeMatch[1]] : [];
    
    // Extract category phrase (match the API logic)
    const sizeWords = ['מידה', 'size', 'מידות', 'sizes'];
    const words = searchQuery.split(/\s+/).filter(word => {
      if (/^\d{2,3}$/.test(word)) return false;
      const lowerWord = word.toLowerCase();
      if (sizeWords.some(sizeWord => 
        word === sizeWord || lowerWord === sizeWord.toLowerCase()
      )) return false;
      return word.length > 0;
    });
    const categoryPhrase = words.join(' ').trim();
    
    console.log('🔍 Debug Search Ranking\n')
    console.log(`Search Query: "${searchQuery}"`)
    console.log(`Category Phrase: "${categoryPhrase}"`)
    console.log(`Size Numbers: ${sizeNumbers.join(', ')}\n`)
    
    // First, check if products have Hebrew category names
    console.log('📊 Checking products with Hebrew category names...\n')
    
    const pumpsProducts = await prisma.product.findMany({
      where: {
        OR: [
          { subSubCategory_he: { contains: 'נעלי סירה' } },
          { subSubCategory: { contains: 'Pumps', mode: 'insensitive' } }
        ],
        isActive: true,
        isDeleted: false
      },
      select: {
        sku: true,
        title_he: true,
        subSubCategory_he: true,
        subSubCategory: true
      },
      take: 5
    })
    
    console.log(`Found ${pumpsProducts.length} pumps products:`)
    pumpsProducts.forEach(p => {
      console.log(`  - ${p.sku}: ${p.title_he}`)
      console.log(`    Category (HE): ${p.subSubCategory_he || 'NULL'}`)
      console.log(`    Category (EN): ${p.subSubCategory || 'NULL'}`)
    })
    
    const bootsProducts = await prisma.product.findMany({
      where: {
        OR: [
          { subSubCategory_he: { contains: 'מגפ' } },
          { subSubCategory: { contains: 'boots', mode: 'insensitive' } }
        ],
        isActive: true,
        isDeleted: false
      },
      select: {
        sku: true,
        title_he: true,
        subSubCategory_he: true,
        subSubCategory: true
      },
      take: 5
    })
    
    console.log(`\nFound ${bootsProducts.length} boots products:`)
    bootsProducts.forEach(p => {
      console.log(`  - ${p.sku}: ${p.title_he}`)
      console.log(`    Category (HE): ${p.subSubCategory_he || 'NULL'}`)
      console.log(`    Category (EN): ${p.subSubCategory || 'NULL'}`)
    })
    
    // Now test the actual search query with ranking breakdown
    console.log('\n\n🔎 Testing search query with ranking breakdown...\n')
    
    const results = await prisma.$queryRaw<Array<{
      sku: string
      title_he: string
      subSubCategory_he: string | null
      subSubCategory: string | null
      fts_rank: number
      category_bonus: number
      size_bonus: number
      total_rank: number
      has_category_match: boolean
      has_size_match: boolean
    }>>(Prisma.sql`
      SELECT 
        p.sku,
        p."title_he",
        p."subSubCategory_he",
        p."subSubCategory",
        -- Full-text search rank
        CASE 
          WHEN p.search_vector @@ websearch_to_tsquery('simple', ${searchQuery})
          THEN ts_rank(p.search_vector, websearch_to_tsquery('simple', ${searchQuery})) * 1000
          ELSE 0
        END AS fts_rank,
        -- Category match bonus
        ${categoryPhrase.length > 0 ? Prisma.sql`
        CASE 
          WHEN (
            p."subSubCategory_he" ILIKE ${`%${categoryPhrase}%`}
            OR p."subCategory_he" ILIKE ${`%${categoryPhrase}%`}
            OR p."category_he" ILIKE ${`%${categoryPhrase}%`}
            OR LOWER(p."subSubCategory") LIKE ${`%${categoryPhrase.toLowerCase()}%`}
            OR LOWER(p."subCategory") LIKE ${`%${categoryPhrase.toLowerCase()}%`}
            OR LOWER(p.category) LIKE ${`%${categoryPhrase.toLowerCase()}%`}
          )
          THEN 2000
          ELSE 0
        END
        ` : Prisma.sql`0`} AS category_bonus,
        -- Size match bonus
        CASE 
          WHEN ${sizeNumbers.length > 0 ? Prisma.sql`EXISTS (
            SELECT 1
            FROM jsonb_each(p."colorVariants") AS variant(color_slug, variant_data),
                 jsonb_each(variant_data->'stockBySize') AS size_entry(size_key, stock_value)
            WHERE size_key = ANY(${sizeNumbers}::text[])
              AND (stock_value::text)::int > 0
          )` : Prisma.sql`false`}
          THEN 20
          ELSE 0
        END AS size_bonus,
        -- Total rank
        (
          ${categoryPhrase.length > 0 ? Prisma.sql`
          CASE 
            WHEN (
              p."subSubCategory_he" ILIKE ${`%${categoryPhrase}%`}
              OR p."subCategory_he" ILIKE ${`%${categoryPhrase}%`}
              OR p."category_he" ILIKE ${`%${categoryPhrase}%`}
              OR LOWER(p."subSubCategory") LIKE ${`%${categoryPhrase.toLowerCase()}%`}
              OR LOWER(p."subCategory") LIKE ${`%${categoryPhrase.toLowerCase()}%`}
              OR LOWER(p.category) LIKE ${`%${categoryPhrase.toLowerCase()}%`}
            )
            THEN 2000
            ELSE 0
          END
          +` : Prisma.sql`0 +`}
          CASE 
            WHEN p.search_vector @@ websearch_to_tsquery('simple', ${searchQuery})
            THEN ts_rank(p.search_vector, websearch_to_tsquery('simple', ${searchQuery})) * 1000
            ELSE 0
          END
          +
          CASE 
            WHEN ${sizeNumbers.length > 0 ? Prisma.sql`EXISTS (
              SELECT 1
              FROM jsonb_each(p."colorVariants") AS variant(color_slug, variant_data),
                   jsonb_each(variant_data->'stockBySize') AS size_entry(size_key, stock_value)
              WHERE size_key = ANY(${sizeNumbers}::text[])
                AND (stock_value::text)::int > 0
            )` : Prisma.sql`false`}
            THEN 20
            ELSE 0
          END
        ) AS total_rank,
        -- Flags
        ${categoryPhrase.length > 0 ? Prisma.sql`(
          p."subSubCategory_he" ILIKE ${`%${categoryPhrase}%`}
          OR p."subCategory_he" ILIKE ${`%${categoryPhrase}%`}
          OR p."category_he" ILIKE ${`%${categoryPhrase}%`}
        )` : Prisma.sql`false`} AS has_category_match,
        ${sizeNumbers.length > 0 ? Prisma.sql`EXISTS (
          SELECT 1
          FROM jsonb_each(p."colorVariants") AS variant(color_slug, variant_data),
               jsonb_each(variant_data->'stockBySize') AS size_entry(size_key, stock_value)
          WHERE size_key = ANY(${sizeNumbers}::text[])
            AND (stock_value::text)::int > 0
        )` : Prisma.sql`false`} AS has_size_match
      FROM products p
      WHERE (
        p.search_vector @@ websearch_to_tsquery('simple', ${searchQuery})
        OR
        ${sizeNumbers.length > 0 ? Prisma.sql`EXISTS (
          SELECT 1
          FROM jsonb_each(p."colorVariants") AS variant(color_slug, variant_data),
               jsonb_each(variant_data->'stockBySize') AS size_entry(size_key, stock_value)
          WHERE size_key = ANY(${sizeNumbers}::text[])
            AND (stock_value::text)::int > 0
        )` : Prisma.sql`false`}
      )
        AND p."isActive" = true
        AND p."isDeleted" = false
      ORDER BY total_rank DESC
      LIMIT 10
    `)
    
    console.log(`\n📋 Top 10 Results with Ranking Breakdown:\n`)
    results.forEach((product, idx) => {
      const isPumps = product.subSubCategory_he?.includes('נעלי סירה') || 
                      product.subSubCategory?.toLowerCase().includes('pumps')
      const isBoots = product.subSubCategory_he?.includes('מגפ') || 
                      product.subSubCategory?.toLowerCase().includes('boots')
      
      console.log(`${idx + 1}. ${product.sku} - ${product.title_he}`)
      console.log(`   Category: ${product.subSubCategory_he || product.subSubCategory || 'N/A'}`)
      console.log(`   Type: ${isPumps ? '🔴 PUMPS' : isBoots ? '⚠️ BOOTS' : '❓ OTHER'}`)
      console.log(`   FTS Rank: ${product.fts_rank.toFixed(2)}`)
      console.log(`   Category Bonus: ${product.category_bonus}`)
      console.log(`   Size Bonus: ${product.size_bonus}`)
      console.log(`   Total Rank: ${product.total_rank.toFixed(2)}`)
      console.log(`   Has Category Match: ${product.has_category_match}`)
      console.log(`   Has Size Match: ${product.has_size_match}`)
      console.log('')
    })
    
    // Summary
    const pumpsCount = results.filter(p => 
      p.subSubCategory_he?.includes('נעלי סירה') || 
      p.subSubCategory?.toLowerCase().includes('pumps')
    ).length
    
    const bootsCount = results.filter(p => 
      p.subSubCategory_he?.includes('מגפ') || 
      p.subSubCategory?.toLowerCase().includes('boots')
    ).length
    
    console.log(`\n📊 Summary:`)
    console.log(`   Pumps in top 10: ${pumpsCount}`)
    console.log(`   Boots in top 10: ${bootsCount}`)
    
    if (bootsCount > pumpsCount) {
      console.log(`\n❌ PROBLEM: Boots are ranking higher than pumps!`)
      console.log(`   This means the category matching logic isn't working correctly.`)
    }
    
  } catch (error) {
    console.error('Error:', error)
    if (error instanceof Error) {
      console.error('Stack:', error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

debugSearchRanking()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error)
    process.exit(1)
  })

