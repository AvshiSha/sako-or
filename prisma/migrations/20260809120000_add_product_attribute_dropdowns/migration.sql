-- Additive-only migration: dropdown-backed product attribute fields (Upper Material,
-- Lining, Insole, Outsole, Sole Type, Toe Shape, Heel Type, Closure Type, Heel Height).
-- Each stores a single stable enum value (or an array for Upper Material); display
-- labels are resolved at render time via lib/product-enums.ts and never persisted.
--
-- Bare column names, distinct from the legacy *_en/*_he free-text pairs already on
-- this table (e.g. "toeShape_en"/"toeShape_he" vs the new "toeShape") — no collision.
-- Legacy columns are left untouched and keep their existing data.

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "upperMaterial" TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "lining" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "insole" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "outsole" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "soleType" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "toeShape" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "heelType" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "closureType" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "heelHeight" TEXT;
  END IF;
END $$;
