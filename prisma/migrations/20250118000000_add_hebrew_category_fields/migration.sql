-- Add Hebrew category fields to products table
-- This allows searching for products by Hebrew category names like "מגפיים"

ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "category_he" TEXT,
ADD COLUMN IF NOT EXISTS "subCategory_he" TEXT,
ADD COLUMN IF NOT EXISTS "subSubCategory_he" TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "products_category_he_idx" ON "products" ("category_he");
CREATE INDEX IF NOT EXISTS "products_subCategory_he_idx" ON "products" ("subCategory_he");
CREATE INDEX IF NOT EXISTS "products_subSubCategory_he_idx" ON "products" ("subSubCategory_he");


