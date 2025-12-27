-- Update search_vector to include Material & Care fields
-- Note: Sizes and colors are searched separately in the query (not in generated column)
-- because PostgreSQL doesn't allow subqueries in generated column expressions

-- Drop the old search_vector column and index
DROP INDEX IF EXISTS "products_search_vector_gin";
ALTER TABLE "products" DROP COLUMN IF EXISTS "search_vector";

-- Recreate search_vector with Material & Care included
-- Sizes and colors are searched via JSON queries in the WHERE clause (see search API)
ALTER TABLE "products"
ADD COLUMN "search_vector" tsvector
GENERATED ALWAYS AS (
  -- English fields with stemming
  setweight(to_tsvector('english', coalesce("title_en", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("description_en", '')), 'B') ||
  
  -- Hebrew fields with simple (no stemming, exact matching)
  setweight(to_tsvector('simple', coalesce("title_he", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("description_he", '')), 'B') ||
  
  -- SKU (language-agnostic, high weight)
  setweight(to_tsvector('simple', coalesce("sku", '')), 'A') ||
  
  -- Material & Care fields (English with stemming)
  setweight(to_tsvector('english', coalesce("upperMaterial_en", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("materialInnerSole_en", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("lining_en", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("sole_en", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("heelHeight_en", '')), 'B') ||
  
  -- Material & Care fields (Hebrew with simple)
  setweight(to_tsvector('simple', coalesce("upperMaterial_he", '')), 'B') ||
  setweight(to_tsvector('simple', coalesce("materialInnerSole_he", '')), 'B') ||
  setweight(to_tsvector('simple', coalesce("lining_he", '')), 'B') ||
  setweight(to_tsvector('simple', coalesce("sole_he", '')), 'B') ||
  setweight(to_tsvector('simple', coalesce("heelHeight_he", '')), 'B') ||
  
  -- Category fields (for searching by category/subcategory names)
  -- These are stored as strings, so we use 'simple' for both English and Hebrew
  setweight(to_tsvector('simple', coalesce("category", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("subCategory", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("subSubCategory", '')), 'A') ||
  
  -- Brand (for searching by brand name)
  setweight(to_tsvector('simple', coalesce("brand", '')), 'B')
) STORED;

-- Recreate GIN index for fast full-text search
CREATE INDEX "products_search_vector_gin"
ON "products"
USING GIN ("search_vector");

