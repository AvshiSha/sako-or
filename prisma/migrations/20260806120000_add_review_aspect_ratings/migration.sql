-- Additive-only migration: separate 1-5 star ratings for the service, the delivery,
-- and the condition the products arrived in — alongside the existing overall rating
-- and the free-text comments.
--
-- All three are nullable: they are optional questions on the review form, and
-- existing rows must stay valid without a backfill.
--
-- Note: product_reviews.title is deliberately NOT dropped here. The form no longer
-- collects a per-product title, but the column is harmless, and keeping it means the
-- decision is reversible without a destructive migration.

DO $$
BEGIN
  IF to_regclass('public.reviews') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "service_rating"   INTEGER;
  ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "delivery_rating"  INTEGER;
  ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "packaging_rating" INTEGER;
END $$;
