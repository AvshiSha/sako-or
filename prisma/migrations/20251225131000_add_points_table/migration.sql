-- Create PointsKind enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PointsKind' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."PointsKind" AS ENUM ('EARN', 'SPEND');
  END IF;
END $$;

-- Create points ledger table (append-only)
CREATE TABLE IF NOT EXISTS "public"."points" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "order_id" TEXT,
  "kind" "public"."PointsKind" NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "points_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (add if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'points_user_id_fkey'
  ) THEN
    ALTER TABLE "public"."points"
    ADD CONSTRAINT "points_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'points_order_id_fkey'
  ) THEN
    ALTER TABLE "public"."points"
    ADD CONSTRAINT "points_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

-- Uniqueness: one EARN row and one SPEND row per order (no duplicates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'points_order_id_kind_key'
  ) THEN
    ALTER TABLE "public"."points"
    ADD CONSTRAINT "points_order_id_kind_key" UNIQUE ("order_id", "kind");
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "points_user_id_created_at_idx" ON "public"."points" ("user_id", "created_at");


