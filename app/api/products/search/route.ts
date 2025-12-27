import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '24')
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        items: [],
        total: 0,
        page: 1,
        limit,
        query: ''
      })
    }

    const searchQuery = query.trim()
    const offset = (page - 1) * limit

    // First, check if search_vector column exists
    const columnCheck = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'search_vector'
    `

    if (columnCheck.length === 0) {
      console.error('search_vector column does not exist. Please run the migration.')
      return NextResponse.json(
        { 
          error: 'Search not configured. Please run database migration.',
          errorDetails: 'search_vector column missing. Run: npx prisma migrate deploy',
          items: [],
          total: 0,
          page: 1,
          limit,
          query: searchQuery
        },
        { status: 500 }
      )
    }

    // Extract size numbers from the search query (e.g., "36", "37", "38")
    // This helps us also search in colorVariants JSON for sizes
    const sizeMatch = searchQuery.match(/\b(\d{2,3})\b/);
    const sizeNumbers = sizeMatch ? [sizeMatch[1]] : [];
    
    // Extract potential color names from the query
    // Common color names in English and Hebrew
    const colorKeywords = searchQuery.toLowerCase().split(/\s+/).filter(word => 
      word.length > 2 && 
      // Common color words (add more as needed)
      ['black', 'white', 'red', 'blue', 'green', 'yellow', 'brown', 'gray', 'grey', 'pink', 'purple', 'orange',
       'שחור', 'לבן', 'אדום', 'כחול', 'ירוק', 'צהוב', 'חום', 'אפור', 'ורוד', 'סגול', 'כתום'].includes(word)
    );
    
    // Use PostgreSQL full-text search with websearch_to_tsquery
    // 'simple' configuration supports both English and Hebrew
    // Using Prisma.sql for proper parameter binding
    // Also search in colorVariants JSON for sizes
    const results = await prisma.$queryRaw<Array<{
      id: string
      sku: string
      title_en: string
      title_he: string
      description_en: string
      description_he: string
      brand: string
      price: number
      salePrice: number | null
      currency: string
      category: string
      subCategory: string | null
      subSubCategory: string | null
      categories_path: string[]
      categories_path_id: string[]
      categoryId: string
      isEnabled: boolean
      isDeleted: boolean
      featured: boolean
      isNew: boolean
      isActive: boolean
      seo_title_en: string | null
      seo_title_he: string | null
      seo_description_en: string | null
      seo_description_he: string | null
      seo_slug: string | null
      searchKeywords: string[]
      colorVariants: any
      createdAt: Date
      updatedAt: Date
      rank: number
    }>>(Prisma.sql`
      SELECT 
        p.id,
        p.sku,
        p."title_en",
        p."title_he",
        p."description_en",
        p."description_he",
        p.brand,
        p.price,
        p."salePrice",
        p.currency,
        p.category,
        p."subCategory",
        p."subSubCategory",
        p."categories_path",
        p."categories_path_id",
        p."categoryId",
        p."isEnabled",
        p."isDeleted",
        p.featured,
        p."isNew",
        p."isActive",
        p."seo_title_en",
        p."seo_title_he",
        p."seo_description_en",
        p."seo_description_he",
        p."seo_slug",
        p."searchKeywords",
        p."colorVariants",
        p."createdAt",
        p."updatedAt",
        ts_rank(p.search_vector, q) AS rank
      FROM products p,
           websearch_to_tsquery('simple', ${searchQuery}) q
      WHERE (
        -- Full-text search in titles, descriptions, SKU, Material & Care, sizes, colors
        p.search_vector @@ q
        OR
        -- Also search for sizes in colorVariants JSON if query contains size numbers
        ${sizeNumbers.length > 0 ? Prisma.sql`EXISTS (
          SELECT 1
          FROM jsonb_each(p."colorVariants") AS variant(color_slug, variant_data),
               jsonb_each(variant_data->'stockBySize') AS size_entry(size_key, stock_value)
          WHERE size_key = ANY(${sizeNumbers}::text[])
            AND (stock_value::text)::int > 0
        )` : Prisma.sql`false`}
        OR
        -- Also search for colors in colorVariants JSON if query contains color keywords
        ${colorKeywords.length > 0 ? Prisma.sql`EXISTS (
          SELECT 1
          FROM jsonb_each(p."colorVariants") AS variant(color_slug, variant_data)
          WHERE (variant_data->>'isActive' IS NULL OR (variant_data->>'isActive')::boolean = true)
            AND (
              color_slug = ANY(${colorKeywords}::text[])
              OR LOWER(variant_data->>'colorSlug') = ANY(${colorKeywords.map(c => c.toLowerCase())}::text[])
            )
        )` : Prisma.sql`false`}
      )
        AND p."isActive" = true
        AND p."isDeleted" = false
      ORDER BY 
        CASE 
          WHEN p.search_vector @@ q THEN ts_rank(p.search_vector, q)
          ELSE 0
        END DESC,
        p."createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `)

    // Get total count for pagination
    const totalResult = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM products p,
           websearch_to_tsquery('simple', ${searchQuery}) q
      WHERE (
        -- Full-text search in titles, descriptions, SKU, Material & Care, sizes, colors
        p.search_vector @@ q
        OR
        -- Also search for sizes in colorVariants JSON if query contains size numbers
        ${sizeNumbers.length > 0 ? Prisma.sql`EXISTS (
          SELECT 1
          FROM jsonb_each(p."colorVariants") AS variant(color_slug, variant_data),
               jsonb_each(variant_data->'stockBySize') AS size_entry(size_key, stock_value)
          WHERE size_key = ANY(${sizeNumbers}::text[])
            AND (stock_value::text)::int > 0
        )` : Prisma.sql`false`}
        OR
        -- Also search for colors in colorVariants JSON if query contains color keywords
        ${colorKeywords.length > 0 ? Prisma.sql`EXISTS (
          SELECT 1
          FROM jsonb_each(p."colorVariants") AS variant(color_slug, variant_data)
          WHERE (variant_data->>'isActive' IS NULL OR (variant_data->>'isActive')::boolean = true)
            AND (
              color_slug = ANY(${colorKeywords}::text[])
              OR LOWER(variant_data->>'colorSlug') = ANY(${colorKeywords.map(c => c.toLowerCase())}::text[])
            )
        )` : Prisma.sql`false`}
      )
        AND p."isActive" = true
        AND p."isDeleted" = false
    `)

    const total = totalResult[0]?.count ? Number(totalResult[0].count) : 0

    // Transform results to match Product interface
    const items = results.map((product) => ({
      id: product.id,
      sku: product.sku,
      title_en: product.title_en,
      title_he: product.title_he,
      description_en: product.description_en,
      description_he: product.description_he,
      brand: product.brand,
      price: product.price,
      salePrice: product.salePrice,
      currency: product.currency,
      category: product.category,
      subCategory: product.subCategory,
      subSubCategory: product.subSubCategory,
      categories_path: product.categories_path,
      categories_path_id: product.categories_path_id,
      categoryId: product.categoryId,
      isEnabled: product.isEnabled,
      isDeleted: product.isDeleted,
      featured: product.featured,
      isNew: product.isNew,
      isActive: product.isActive,
      seo: {
        title_en: product.seo_title_en,
        title_he: product.seo_title_he,
        description_en: product.seo_description_en,
        description_he: product.seo_description_he,
        slug: product.seo_slug
      },
      searchKeywords: product.searchKeywords,
      colorVariants: product.colorVariants,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    }))

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      query: searchQuery
    })
    
  } catch (error) {
    console.error('Search error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    return NextResponse.json(
      { 
        error: 'Failed to search products',
        errorDetails: errorMessage,
        errorStack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
        items: [],
        total: 0,
        page: 1,
        limit: 24,
        query: searchQuery || ''
      },
      { status: 500 }
    )
  }
}
