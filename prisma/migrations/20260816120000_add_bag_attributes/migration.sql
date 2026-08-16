-- Additive-only migration: structured bag attributes, plus the numeric dimension
-- and weight columns shared by every non-shoe product type.
--
-- Two groups of columns:
--
--   1. heightCm/widthCm/depthCm/weightGrams — shared. These supersede the
--      free-text materialCare.height_en/_he, width_en/_he, depth_en/_he fields,
--      which only ever existed in Firestore and never reached Postgres at all.
--      The legacy text is left in Firestore untouched, surfaced in the admin as
--      a reconciliation hint. Populated by scripts/backfill-bag-dimensions.ts.
--
--   2. bagType … fitsLaptopInches — flattened from the Firestore `bagSpecs`
--      group by app/api/admin/products/sync/route.ts, the same way shoeFit.* is
--      flattened today.
--
-- Every boolean is nullable with NO default. A DEFAULT FALSE would assert
-- "this bag has no base feet / does not fit A4" for every product that nobody
-- has audited yet; unknown has to stay unknown. Same reasoning for the numeric
-- columns: absent is NULL, never 0.

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    -- Shared structured measurements
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "heightCm" DOUBLE PRECISION;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "widthCm" DOUBLE PRECISION;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "depthCm" DOUBLE PRECISION;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weightGrams" INTEGER;

    -- Bag attributes, entered by staff
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "bagType" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "intendedUse" TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "carryingOptions" TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "bagStyle" TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "bagStructure" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "strapType" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "strapDropCm" DOUBLE PRECISION;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "adjustableStrap" BOOLEAN;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "removableStrap" BOOLEAN;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "mainCompartments" INTEGER;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "internalPockets" INTEGER;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "externalPockets" INTEGER;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "hardwareColor" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "baseFeet" BOOLEAN;

    -- Derived from the dimensions above at sync time (lib/bag-derived.ts), or
    -- taken from an admin override. Persisted so filtering stays plain SQL.
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "bagCapacityLiters" DOUBLE PRECISION;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "bagSizeCategory" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "fitsA4" BOOLEAN;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "fitsTablet" BOOLEAN;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "fitsLaptopInches" INTEGER;

    -- Facets the bag assistant filters on. B-tree for the single-value columns,
    -- GIN for the arrays so `intendedUse && ARRAY['work']` stays indexed.
    CREATE INDEX IF NOT EXISTS "products_bagType_idx" ON "products" ("bagType");
    CREATE INDEX IF NOT EXISTS "products_bagSizeCategory_idx" ON "products" ("bagSizeCategory");
    CREATE INDEX IF NOT EXISTS "products_intendedUse_idx" ON "products" USING GIN ("intendedUse");
    CREATE INDEX IF NOT EXISTS "products_carryingOptions_idx" ON "products" USING GIN ("carryingOptions");
  END IF;
END $$;
