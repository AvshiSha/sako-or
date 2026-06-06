/**
 * Debug script to test weighted search ranking with pg_trgm + FTS.
 * Usage: npx tsx scripts/debug-search-ranking.ts [query]
 */

import { searchProducts } from '../lib/search-products'
import { buildSearchQueryTerms, normalizeHebrewForSearch } from '../lib/hebrew-normalize'
import { prisma } from '../lib/prisma'

const DEFAULT_QUERIES = [
  'נעלי סירה מידה 37',
  'כפכפים',
  'כפכף אדום',
  'מגפ',
  'sandals black',
  'SAK',
]

async function debugQuery(searchQuery: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Query: "${searchQuery}"`)
  console.log(`Normalized: "${normalizeHebrewForSearch(searchQuery)}"`)
  console.log(`Terms: [${buildSearchQueryTerms(searchQuery).join(', ')}]`)

  const columnCheck = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'search_blob_norm'
  `

  if (columnCheck.length > 0) {
    const topSimilar = await prisma.$queryRaw<
      Array<{ sku: string; title_he: string; score: number }>
    >`
      SELECT
        sku,
        "title_he",
        similarity(search_blob_norm, normalize_hebrew_search(${searchQuery})) AS score
      FROM products
      WHERE "isActive" = true AND "isDeleted" = false
      ORDER BY score DESC
      LIMIT 5
    `

    console.log('\nTop trigram matches:')
    topSimilar.forEach((row, i) => {
      console.log(`  ${i + 1}. [${row.score.toFixed(3)}] ${row.sku} — ${row.title_he}`)
    })
  }

  const result = await searchProducts(searchQuery, 1, 5)
  console.log(`\nSearch API results (${result.total} total):`)
  result.items.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.sku} — ${item.title_he}`)
    console.log(`     Category: ${item.subSubCategory_he || item.subSubCategory || 'N/A'}`)
  })
}

async function debugSearchRanking() {
  const queries = process.argv.slice(2)
  const testQueries = queries.length > 0 ? queries : DEFAULT_QUERIES

  console.log('Search Ranking Debug')
  console.log(`Backend: ${process.env.SEARCH_BACKEND || 'postgres'}`)

  for (const q of testQueries) {
    await debugQuery(q)
  }
}

debugSearchRanking()
  .catch((error) => {
    console.error('Debug failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
