-- Additive-only migration: free-text notes for the packaging / condition-on-arrival
-- question, pairing with the packaging_rating column added earlier.
--
-- Nullable: the field is optional on the form, and existing rows stay valid without
-- a backfill.

DO $$
BEGIN
  IF to_regclass('public.reviews') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "packaging_comment" TEXT;
END $$;
