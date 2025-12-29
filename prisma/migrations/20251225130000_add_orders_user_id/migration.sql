-- Add optional user reference to orders (guest checkout allowed)
ALTER TABLE "public"."orders"
ADD COLUMN IF NOT EXISTS "user_id" UUID;

-- Add FK constraint if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_user_id_fkey'
  ) THEN
    ALTER TABLE "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

-- Index for faster lookups by user
CREATE INDEX IF NOT EXISTS "orders_user_id_idx" ON "public"."orders" ("user_id");


