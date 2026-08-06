-- Additive-only migration: tracking for the manual loyalty-points follow-up on a
-- review, plus the customer notification that the points changed.
--
-- Loyalty points for reviewing are credited by hand in Verifone, so nothing in this
-- system can observe that it happened. These columns are the record of that manual
-- step — without them there is no way to answer "which reviewers still owe points?"
-- or to avoid paying the same customer twice.

DO $$
BEGIN
  IF to_regclass('public.reviews') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "points_awarded_at"  TIMESTAMP(3);
  ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "points_before"      DECIMAL(10,2);
  ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "points_after"       DECIMAL(10,2);
  ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "points_awarded_by"  TEXT;
  ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "notified_at"        TIMESTAMP(3);
  ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "notify_result"      JSONB;

  -- Partial-free plain index: the admin queue filters on this being NULL.
  CREATE INDEX IF NOT EXISTS "reviews_points_awarded_at_idx"
    ON "reviews" ("points_awarded_at");
END $$;
