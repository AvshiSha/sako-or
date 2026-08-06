-- Additive-only migration: a catch-all free-text box on the review form, for
-- anything the specific questions did not cover.
--
-- Nullable and optional, so existing rows stay valid without a backfill.

DO $$
BEGIN
  IF to_regclass('public.reviews') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "general_comment" TEXT;
END $$;
