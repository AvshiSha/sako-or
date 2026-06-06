import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isMeilisearchConfigured } from '@/lib/meilisearch'
import { searchProducts } from '@/lib/search-products'

const ACCEPTANCE_QUERIES = [
  'כפכפים',
  'נעלי סירה',
  'נעל סירה',
  'כפכף אדום',
  'sandals black',
  'מגפ',
  'SAK',
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const testQuery = searchParams.get('q')

    const columnCheck = await prisma.$queryRaw<
      Array<{ column_name: string; data_type: string }>
    >`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'products'
        AND column_name IN (
          'search_vector',
          'search_blob_norm',
          'colors_search_norm',
          'title_search_norm'
        )
    `

    const extensionCheck = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'
    `

    const indexCheck = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'products'
        AND indexname IN ('products_search_vector_gin', 'products_search_blob_norm_gin')
    `

    const sampleProducts = await prisma.$queryRaw<
      Array<{
        id: string
        sku: string
        title_he: string
        search_vector: string
        search_blob_norm: string | null
        colors_search_norm: string | null
      }>
    >`
      SELECT
        id,
        sku,
        "title_he",
        search_vector::text AS search_vector,
        search_blob_norm,
        colors_search_norm
      FROM products
      LIMIT 5
    `

    const populatedCounts = await prisma.$queryRaw<
      Array<{ search_vector_count: bigint; blob_count: bigint; colors_count: bigint }>
    >`
      SELECT
        COUNT(*) FILTER (WHERE search_vector IS NOT NULL) AS search_vector_count,
        COUNT(*) FILTER (WHERE search_blob_norm IS NOT NULL AND search_blob_norm <> '') AS blob_count,
        COUNT(*) FILTER (WHERE colors_search_norm IS NOT NULL AND colors_search_norm <> '') AS colors_count
      FROM products
    `

    const totalProducts = await prisma.product.count()
    const activeProducts = await prisma.product.count({
      where: { isActive: true, isDeleted: false },
    })

    let similaritySample: Array<{ query: string; top_match: string; rank: number }> = []
    const hasTrigram = columnCheck.some((c) => c.column_name === 'search_blob_norm')

    if (hasTrigram && testQuery) {
      const sample = await prisma.$queryRaw<
        Array<{ title_he: string; similarity: number }>
      >`
        SELECT
          "title_he",
          similarity(search_blob_norm, normalize_hebrew_search(${testQuery})) AS similarity
        FROM products
        WHERE "isActive" = true AND "isDeleted" = false
        ORDER BY similarity DESC
        LIMIT 3
      `
      similaritySample = sample.map((row) => ({
        query: testQuery,
        top_match: row.title_he,
        rank: Number(row.similarity),
      }))
    }

    let acceptanceResults: Array<{ query: string; total: number; top_title: string | null }> = []
    if (hasTrigram) {
      for (const q of ACCEPTANCE_QUERIES) {
        const result = await searchProducts(q, 1, 3)
        acceptanceResults.push({
          query: q,
          total: result.total,
          top_title: result.items[0]?.title_he ?? null,
        })
      }
    }

    const counts = populatedCounts[0]

    return NextResponse.json({
      pgTrgmEnabled: extensionCheck.length > 0,
      searchBackend: process.env.SEARCH_BACKEND || 'postgres',
      meilisearchConfigured: isMeilisearchConfigured(),
      columns: columnCheck.map((c) => c.column_name),
      indexes: indexCheck.map((i) => i.indexname),
      totalProducts,
      activeProducts,
      productsWithSearchVector: Number(counts?.search_vector_count || 0),
      productsWithSearchBlob: Number(counts?.blob_count || 0),
      productsWithColorsNorm: Number(counts?.colors_count || 0),
      sampleProducts: sampleProducts.map((p) => ({
        id: p.id,
        sku: p.sku,
        title_he: p.title_he,
        searchVectorPreview: p.search_vector?.substring(0, 80),
        searchBlobPreview: p.search_blob_norm?.substring(0, 80),
        colorsSearchNorm: p.colors_search_norm,
      })),
      similaritySample,
      acceptanceResults,
      recommendations: [
        extensionCheck.length === 0 ? 'Run migration to enable pg_trgm extension' : null,
        !columnCheck.some((c) => c.column_name === 'search_blob_norm')
          ? 'Run migration for search_blob_norm column'
          : null,
        Number(counts?.colors_count || 0) === 0
          ? 'Run scripts/backfill-colors-search-norm.ts to populate colors'
          : null,
        activeProducts === 0 ? 'No active products found' : null,
      ].filter(Boolean),
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json(
      {
        error: 'Failed to check search setup',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
