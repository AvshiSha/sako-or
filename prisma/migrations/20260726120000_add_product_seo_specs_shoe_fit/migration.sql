-- Additive-only migration: structured product fields for SEO, specifications and
-- shoe fit/sizing. Every new column is nullable or defaults to an empty array, so
-- existing products/rows remain valid without a backfill.
--
-- Column names intentionally match the existing Product model convention (no @map,
-- quoted camelCase identifiers matching Prisma field names, e.g. "heelHeight_en").

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    -- Basic information additions
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "shortTitle_en" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "shortTitle_he" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "shortDescription_en" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "shortDescription_he" TEXT;

    -- Structured specification additions
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "toeShape_en" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "toeShape_he" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "pattern_en" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "pattern_he" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "finish_en" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "finish_he" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "closureType_en" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "closureType_he" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "heelType_en" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "heelType_he" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "careInstructions_en" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "careInstructions_he" TEXT;

    -- Shoe fit & sizing
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sizeFit" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "footWidthFit" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "toeBoxFit" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "instepFit" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "archFit" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "adjustableFeatures" TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "fitRecommendation_en" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "fitRecommendation_he" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "fitNotes_en" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "fitNotes_he" TEXT;

    -- SEO focus/secondary keywords (seo_title_en/he, seo_description_en/he, seo_slug already exist)
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "seoFocusKeyword_en" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "seoFocusKeyword_he" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "seoSecondaryKeywords_en" TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "seoSecondaryKeywords_he" TEXT[] NOT NULL DEFAULT '{}';
  END IF;
END $$;
