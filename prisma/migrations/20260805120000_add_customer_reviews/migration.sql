-- Additive-only migration: customer reviews captured from the post-delivery review
-- link. Two tables, no changes to existing columns.
--
-- Idempotent throughout (IF NOT EXISTS) to match the house style and tolerate re-runs.

DO $$
BEGIN
  IF to_regclass('public.orders') IS NULL OR to_regclass('public.order_items') IS NULL THEN
    RETURN;
  END IF;

  ----------------------------------------------------------------------------
  -- reviews
  ----------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS "reviews" (
    "id"                TEXT NOT NULL,
    "order_id"          TEXT NOT NULL,
    "order_number"      TEXT NOT NULL,
    "user_id"           UUID,
    "overall_rating"    INTEGER NOT NULL,
    "service_comment"   TEXT,
    "delivery_comment"  TEXT,
    "language"          TEXT NOT NULL DEFAULT 'he',
    "submitted_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
  );

  -- One review per order. Also the guard that stops a leaked review link being
  -- replayed to submit repeatedly.
  CREATE UNIQUE INDEX IF NOT EXISTS "reviews_order_id_key" ON "reviews" ("order_id");
  CREATE INDEX IF NOT EXISTS "reviews_order_number_idx"  ON "reviews" ("order_number");
  CREATE INDEX IF NOT EXISTS "reviews_submitted_at_idx"  ON "reviews" ("submitted_at" DESC);

  ----------------------------------------------------------------------------
  -- product_reviews
  ----------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS "product_reviews" (
    "id"            TEXT NOT NULL,
    "review_id"     TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "product_sku"   TEXT NOT NULL,
    "rating"        INTEGER NOT NULL,
    "title"         TEXT,
    "body"          TEXT,
    "sizing_fit"    TEXT,
    "photo_url"     TEXT,
    "is_published"  BOOLEAN NOT NULL DEFAULT false,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
  );

  CREATE UNIQUE INDEX IF NOT EXISTS "product_reviews_review_id_order_item_id_key"
    ON "product_reviews" ("review_id", "order_item_id");
  CREATE INDEX IF NOT EXISTS "product_reviews_product_sku_is_published_idx"
    ON "product_reviews" ("product_sku", "is_published");

  ----------------------------------------------------------------------------
  -- Foreign keys
  ----------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_order_id_fkey') THEN
    ALTER TABLE "reviews"
      ADD CONSTRAINT "reviews_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_user_id_fkey') THEN
    ALTER TABLE "reviews"
      ADD CONSTRAINT "reviews_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_reviews_review_id_fkey') THEN
    ALTER TABLE "product_reviews"
      ADD CONSTRAINT "product_reviews_review_id_fkey"
      FOREIGN KEY ("review_id") REFERENCES "reviews" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_reviews_order_item_id_fkey') THEN
    ALTER TABLE "product_reviews"
      ADD CONSTRAINT "product_reviews_order_item_id_fkey"
      FOREIGN KEY ("order_item_id") REFERENCES "order_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
