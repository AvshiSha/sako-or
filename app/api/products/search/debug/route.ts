import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Debug endpoint to check search setup
export async function GET(request: NextRequest) {
  try {
    // Check if search_vector column exists
    const columnCheck = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'search_vector'
    `

    // Check if index exists
    const indexCheck = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'products' AND indexname = 'products_search_vector_gin'
    `

    // Check sample products and their search_vector
    // Cast tsvector to text for Prisma compatibility
    const sampleProducts = await prisma.$queryRaw<Array<{
      id: string
      sku: string
      title_en: string
      title_he: string
      search_vector: string
      isActive: boolean
      isDeleted: boolean
    }>>`
      SELECT 
        id,
        sku,
        "title_en",
        "title_he",
        search_vector::text as search_vector,
        "isActive",
        "isDeleted"
      FROM products
      LIMIT 5
    `

    // Count total products
    const totalProducts = await prisma.product.count()
    const activeProducts = await prisma.product.count({
      where: {
        isActive: true,
        isDeleted: false
      }
    })

    // Check if search_vector is populated
    const productsWithSearchVector = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::int AS count
      FROM products
      WHERE search_vector IS NOT NULL
    `

    return NextResponse.json({
      searchVectorColumnExists: columnCheck.length > 0,
      searchVectorIndexExists: indexCheck.length > 0,
      totalProducts,
      activeProducts,
      productsWithSearchVector: Number(productsWithSearchVector[0]?.count || 0),
      sampleProducts: sampleProducts.map(p => ({
        id: p.id,
        sku: p.sku,
        title_en: p.title_en,
        title_he: p.title_he,
        hasSearchVector: p.search_vector !== null,
        searchVectorPreview: p.search_vector ? String(p.search_vector).substring(0, 100) : null,
        isActive: p.isActive,
        isDeleted: p.isDeleted
      })),
      recommendations: [
        columnCheck.length === 0 ? 'Run migration: npx prisma migrate deploy' : null,
        indexCheck.length === 0 ? 'Search index missing - run migration' : null,
        Number(productsWithSearchVector[0]?.count || 0) === 0 ? 'search_vector column is empty - products may need to be updated' : null,
        activeProducts === 0 ? 'No active products found' : null
      ].filter(Boolean)
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to check search setup',
        errorDetails: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

