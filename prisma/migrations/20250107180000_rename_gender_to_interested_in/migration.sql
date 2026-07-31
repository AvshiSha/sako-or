-- Rename gender column to interested_in
-- Add interested_in column (replacing former gender column)
DO $$
BEGIN
  -- Guard for Prisma shadow DB / environments where users table doesn't exist yet
  -- (same pattern as the sibling search_vector migrations right after this one).
  IF to_regclass('public.users') IS NOT NULL THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "interested_in" TEXT;
  END IF;
END $$;

