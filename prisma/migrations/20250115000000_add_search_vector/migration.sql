-- Add search_vector column for full-text search (English + Hebrew)
-- This is a generated column that combines English and Hebrew text fields
DO $$
BEGIN
  -- Guard for Prisma shadow DB / environments where products table doesn't exist yet.
  IF to_regclass('public.products') IS NOT NULL THEN
    ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "search_vector" tsvector
    GENERATED ALWAYS AS (
      -- English fields with stemming
      setweight(to_tsvector('english', coalesce("title_en", '')), 'A') ||
      setweight(to_tsvector('english', coalesce("description_en", '')), 'B') ||
      
      -- Hebrew fields with simple (no stemming, exact matching)
      setweight(to_tsvector('simple', coalesce("title_he", '')), 'A') ||
      setweight(to_tsvector('simple', coalesce("description_he", '')), 'B') ||
      
      -- SKU (language-agnostic, high weight)
      setweight(to_tsvector('simple', coalesce("sku", '')), 'A')
    ) STORED;

    -- Create GIN index for fast full-text search
    CREATE INDEX IF NOT EXISTS "products_search_vector_gin"
    ON "products"
    USING GIN ("search_vector");

    -- Also create index on isActive and isDeleted for filtering
    CREATE INDEX IF NOT EXISTS "products_active_deleted_idx"
    ON "products" ("isActive", "isDeleted")
    WHERE "isActive" = true AND "isDeleted" = false;
  END IF;
END $$;

