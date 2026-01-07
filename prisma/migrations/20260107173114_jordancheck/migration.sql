/*
  Warnings:

  - Added the required column `birthday` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "products" ADD COLUMN     "category_he" TEXT,
ADD COLUMN     "subCategory_he" TEXT,
ADD COLUMN     "subSubCategory_he" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "birthday" DATE NOT NULL;

-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "product_base_sku" TEXT NOT NULL,
    "color_slug" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "favorited_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unfavorited_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "favorites_user_id_is_active_idx" ON "favorites"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_product_base_sku_color_slug_key" ON "favorites"("user_id", "product_base_sku", "color_slug");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
