-- Auto-generated search keywords (separate from manual admin searchKeywords).
-- Lightweight column only; does not recreate search_blob_norm or search_vector.

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "generated_search_keywords" TEXT[] NOT NULL DEFAULT '{}';
  END IF;
END $$;
