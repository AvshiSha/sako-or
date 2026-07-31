-- Additive-only migration: records which version of the Terms & Conditions
-- page a customer accepted at checkout, and when. Both columns are nullable
-- so existing orders remain valid without a backfill.

DO $$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL THEN
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "terms_accepted_version" TEXT;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP(3);
  END IF;
END $$;
