import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { expandHebrewQuery, generateHebrewVariations } from '@/lib/hebrew-normalize'

export interface SearchProductsResult {
  items: any[]
  total: number
  page: number
  limit: number
  query: string
}

export async function searchProducts(
  query: string,
  page: number = 1,
  limit: number = 24
): Promise<SearchProductsResult> {
  if (!query || query.trim().length === 0) {
    return {
      items: [],
      total: 0,
      page: 1,
      limit,
      query: ''
    }
  }

  const searchQuery = query.trim()
  
  // Validate page parameter to prevent NaN in calculations
  const validatedPage = Number.isInteger(page) && page > 0 ? page : 1
  const offset = (validatedPage - 1) * limit

  // First, check if search_vector column exists
  const columnCheck = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'search_vector'
  `

  if (columnCheck.length === 0) {
    console.error('search_vector column does not exist. Please run the migration.')
    return {
      items: [],
      total: 0,
      page: 1,
      limit,
      query: searchQuery
    }
  }

  // Extract size numbers from the search query (e.g., "36", "37", "38")
  // This helps us also search in colorVariants JSON for sizes
  const sizeMatch = searchQuery.match(/\b(\d{2,3})\b/);
  const sizeNumbers = sizeMatch ? [sizeMatch[1]] : [];
  
  // Hebrew to English color mapping (for matching Hebrew queries to English color slugs in database)
  const hebrewToEnglishColors: Record<string, string> = {
    'שחור': 'black',
    'לבן': 'white',
    'אדום': 'red',
    'כחול': 'blue',
    'ירוק': 'green',
    'צהוב': 'yellow',
    'חום': 'brown',
    'אפור': 'gray',
    'ורוד': 'pink',
    'סגול': 'purple',
    'כתום': 'orange'
  };
  
  // Extract potential color names from the query and expand with variations
  // Common color names in English and Hebrew
  // Note: Don't use toLowerCase() for Hebrew, as it doesn't change Hebrew text
  const words = searchQuery.split(/\s+/);
  const baseColorKeywords = words.filter(word => {
    const trimmedWord = word.trim();
    if (trimmedWord.length <= 2) return false;
    // Check both original case and lowercase (for English colors)
    const lowerWord = trimmedWord.toLowerCase();
    return ['black', 'white', 'red', 'blue', 'green', 'yellow', 'brown', 'gray', 'grey', 'pink', 'purple', 'orange',
            'שחור', 'לבן', 'אדום', 'כחול', 'ירוק', 'צהוב', 'חום', 'אפור', 'ורוד', 'סגול', 'כתום'].includes(trimmedWord) ||
           ['black', 'white', 'red', 'blue', 'green', 'yellow', 'brown', 'gray', 'grey', 'pink', 'purple', 'orange'].includes(lowerWord);
  });
  
  // Expand color keywords with Hebrew variations (singular/plural, gender) and English translations
  const colorKeywords = new Set<string>();
  baseColorKeywords.forEach(color => {
    if (color && color.trim().length > 0) {
      // Add original word (preserve case for Hebrew, lowercase for English)
      const isHebrew = /[\u0590-\u05FF]/.test(color);
      if (isHebrew) {
        const trimmedColor = color.trim();
        colorKeywords.add(trimmedColor);
        
        // Add Hebrew variations (singular/plural, gender)
        const variations = generateHebrewVariations(trimmedColor);
        variations.forEach(v => {
          if (v && v.trim().length > 0) {
            colorKeywords.add(v.trim());
          }
        });
        
        // CRITICAL: Also add the English translation for Hebrew colors
        // This allows matching "אדום" to "red" in the database
        const englishTranslation = hebrewToEnglishColors[trimmedColor];
        if (englishTranslation) {
          colorKeywords.add(englishTranslation.toLowerCase());
        }
        
        // Also add English translations for Hebrew variations
        variations.forEach(v => {
          const engTranslation = hebrewToEnglishColors[v.trim()];
          if (engTranslation) {
            colorKeywords.add(engTranslation.toLowerCase());
          }
        });
      } else {
        colorKeywords.add(color.trim().toLowerCase());
      }
    }
  });
  
  // Extract category phrase from the query (remove size numbers and common words)
  // This helps prioritize products matching category names
  // For "נעלי סירה מידה 37" → "נעלי סירה"
  // Note: Hebrew doesn't use word boundaries like English, so we split and filter
  const sizeWords = ['מידה', 'size', 'מידות', 'sizes'];
  const categoryWords = searchQuery.split(/\s+/).filter(word => {
    // Remove size numbers
    if (/^\d{2,3}$/.test(word)) return false;
    // Remove size-related words (case-insensitive for English, exact for Hebrew)
    const lowerWord = word.toLowerCase();
    if (sizeWords.some(sizeWord => 
      word === sizeWord || lowerWord === sizeWord.toLowerCase()
    )) return false;
    return word.length > 0;
  });
  const categoryPhrase = categoryWords.join(' ').trim();
  
  // Expand category phrase with Hebrew variations (singular/plural)
  // For "כפכף" → ["כפכף", "כפכפים"]
  // Filter out empty strings to avoid SQL errors
  const categoryPhraseVariations = expandHebrewQuery(categoryPhrase).filter(v => v && typeof v === 'string' && v.trim().length > 0);
  
  // Build category matching conditions for SQL
  // Filter out empty phrases and ensure we have valid strings
  const categoryConditions: Prisma.Sql[] = [];
  if (categoryPhraseVariations.length > 0) {
    for (const phrase of categoryPhraseVariations) {
      if (phrase && typeof phrase === 'string' && phrase.trim().length > 0) {
        const trimmedPhrase = phrase.trim();
        categoryConditions.push(
          Prisma.sql`(
            p."subSubCategory_he" ILIKE ${`%${trimmedPhrase}%`}
            OR p."subCategory_he" ILIKE ${`%${trimmedPhrase}%`}
            OR p."category_he" ILIKE ${`%${trimmedPhrase}%`}
            OR LOWER(p."subSubCategory") LIKE ${`%${trimmedPhrase.toLowerCase()}%`}
            OR LOWER(p."subCategory") LIKE ${`%${trimmedPhrase.toLowerCase()}%`}
            OR LOWER(p.category) LIKE ${`%${trimmedPhrase.toLowerCase()}%`}
          )`
        );
      }
    }
  }
  
  // Build category match SQL fragments (avoiding Prisma.join type issues)
  const hasCategoryConditions = categoryConditions.length > 0;
  let categoryMatchRankSql: Prisma.Sql = Prisma.sql`0`;
  let categoryMatchWhereSql: Prisma.Sql = Prisma.sql`false`;
  
  if (hasCategoryConditions) {
    // Build OR conditions manually (Prisma.join has type issues)
    // For single condition, use it directly; for multiple, chain with OR
    let joinedConditions: Prisma.Sql;
    if (categoryConditions.length === 1) {
      joinedConditions = categoryConditions[0];
    } else {
      // Chain multiple conditions with OR
      joinedConditions = categoryConditions.reduce((acc, condition, index) => {
        if (index === 0) {
          return condition;
        }
        return Prisma.sql`${acc} OR ${condition}`;
      }, categoryConditions[0]);
    }
    
    categoryMatchRankSql = Prisma.sql`
      CASE 
        WHEN (${joinedConditions})
        THEN 2000
        ELSE 0
      END
    `;
    
    categoryMatchWhereSql = Prisma.sql`(${joinedConditions})`;
  }
  
  // Also extract individual keywords for partial matching with variations
  const categoryKeywords = new Set<string>();
  categoryPhrase.split(/\s+/).filter(word => word.length > 1).forEach(word => {
    categoryKeywords.add(word);
    const variations = generateHebrewVariations(word);
    variations.forEach(v => categoryKeywords.add(v));
  });
  
  // Use PostgreSQL full-text search with websearch_to_tsquery
  // 'simple' configuration supports both English and Hebrew
  // Using Prisma.sql for proper parameter binding
  // Also search in colorVariants JSON for sizes
  // Improved ranking: full-text matches rank highest, size/color matches rank lower
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
      -- Improved ranking: combine full-text search rank with category/size/color match bonuses
      -- Higher rank = more relevant
      (
        -- CRITICAL: Category name exact match bonus (HIGHEST weight - must be first!)
        -- Check if category phrase (or any of its variations) matches Hebrew or English category fields
        -- For query "כפכף אדום", this checks if "כפכף" OR "כפכפים" is in category fields
        -- This ensures products matching the category name rank highest
        ${categoryMatchRankSql}
        +
        -- Primary: Full-text search rank (high weight, 0-1 range, multiplied by 1000)
        -- This includes matches in title, description, category names, etc.
        -- Products with category match already got 2000, so this adds to that
        CASE 
          WHEN p.search_vector @@ q THEN ts_rank(p.search_vector, q) * 1000
          ELSE 0
        END
        +
        -- Bonus: Category/subcategory matches via full-text (medium weight)
        -- Create a tsvector for just category fields and check if query matches
        CASE 
          WHEN to_tsvector('simple', 
            COALESCE(p."category_he", '') || ' ' || 
            COALESCE(p."subCategory_he", '') || ' ' || 
            COALESCE(p."subSubCategory_he", '') || ' ' ||
            COALESCE(p.category, '') || ' ' || 
            COALESCE(p."subCategory", '') || ' ' || 
            COALESCE(p."subSubCategory", '')
          ) @@ q
          THEN 300
          ELSE 0
        END
        +
        -- Bonus: Size match (lower weight, but still meaningful)
        -- Products matching only on size should rank lower than category matches
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
        +
        -- Bonus: Color match (higher weight - important for queries like "כפכף אדום")
        -- Match any color variation (e.g., "אדום", "אדומים", "אדומה", "אד")
        -- Check JSON key (color_slug), colorSlug field, and colorName field
        -- Use exact matches first, then check if any field contains the color keyword
        CASE 
          WHEN ${Array.from(colorKeywords).length > 0 ? Prisma.sql`EXISTS (
            SELECT 1
            FROM jsonb_each(p."colorVariants") AS variant(color_slug, variant_data)
            WHERE (variant_data->>'isActive' IS NULL OR (variant_data->>'isActive')::boolean = true)
              AND (
                -- Exact match on JSON key
                color_slug = ANY(${Array.from(colorKeywords)}::text[])
                -- Exact match on colorSlug field
                OR (variant_data->>'colorSlug')::text = ANY(${Array.from(colorKeywords)}::text[])
                -- Exact match on colorName field
                OR (variant_data->>'colorName')::text = ANY(${Array.from(colorKeywords)}::text[])
                -- Case-insensitive match on JSON key (for English colors)
                OR LOWER(color_slug) = ANY(${Array.from(colorKeywords).map(c => c.toLowerCase())}::text[])
                -- Case-insensitive match on colorSlug field
                OR LOWER((variant_data->>'colorSlug')::text) = ANY(${Array.from(colorKeywords).map(c => c.toLowerCase())}::text[])
                -- Case-insensitive match on colorName field
                OR LOWER((variant_data->>'colorName')::text) = ANY(${Array.from(colorKeywords).map(c => c.toLowerCase())}::text[])
              )
          )` : Prisma.sql`false`}
          THEN 500
          ELSE 0
        END
      ) AS rank
    FROM products p,
         websearch_to_tsquery('simple', ${searchQuery}) q
    WHERE (
      -- Full-text search in titles, descriptions, SKU, Material & Care, categories
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
      -- Match any color variation (e.g., "אדום", "אדומים", "אדומה", "אד")
      ${Array.from(colorKeywords).length > 0 ? Prisma.sql`EXISTS (
        SELECT 1
        FROM jsonb_each(p."colorVariants") AS variant(color_slug, variant_data)
        WHERE (variant_data->>'isActive' IS NULL OR (variant_data->>'isActive')::boolean = true)
          AND (
            -- Exact match on JSON key
            color_slug = ANY(${Array.from(colorKeywords)}::text[])
            -- Exact match on colorSlug field
            OR (variant_data->>'colorSlug')::text = ANY(${Array.from(colorKeywords)}::text[])
            -- Exact match on colorName field
            OR (variant_data->>'colorName')::text = ANY(${Array.from(colorKeywords)}::text[])
            -- Case-insensitive match on JSON key (for English colors)
            OR LOWER(color_slug) = ANY(${Array.from(colorKeywords).map(c => c.toLowerCase())}::text[])
            -- Case-insensitive match on colorSlug field
            OR LOWER((variant_data->>'colorSlug')::text) = ANY(${Array.from(colorKeywords).map(c => c.toLowerCase())}::text[])
            -- Case-insensitive match on colorName field
            OR LOWER((variant_data->>'colorName')::text) = ANY(${Array.from(colorKeywords).map(c => c.toLowerCase())}::text[])
          )
      )` : Prisma.sql`false`}
      OR
      -- Also search for category variations (e.g., "כפכף" OR "כפכפים")
      ${categoryMatchWhereSql}
    )
      AND p."isActive" = true
      AND p."isDeleted" = false
    ORDER BY 
      rank DESC,
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
      -- Match any color variation (e.g., "אדום", "אדומים", "אדומה", "אד")
      ${Array.from(colorKeywords).length > 0 ? Prisma.sql`EXISTS (
        SELECT 1
        FROM jsonb_each(p."colorVariants") AS variant(color_slug, variant_data)
        WHERE (variant_data->>'isActive' IS NULL OR (variant_data->>'isActive')::boolean = true)
          AND (
            color_slug = ANY(${Array.from(colorKeywords)}::text[])
            OR LOWER(variant_data->>'colorSlug') = ANY(${Array.from(colorKeywords).map(c => c.toLowerCase())}::text[])
            OR LOWER(variant_data->>'colorName') = ANY(${Array.from(colorKeywords).map(c => c.toLowerCase())}::text[])
          )
      )` : Prisma.sql`false`}
      OR
      -- Also search for category variations (e.g., "כפכף" OR "כפכפים")
      ${categoryMatchWhereSql}
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

  return {
    items,
    total,
    page: validatedPage,
    limit,
    query: searchQuery
  }
}

