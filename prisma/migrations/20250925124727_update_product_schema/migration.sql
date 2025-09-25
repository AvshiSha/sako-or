/*
  Warnings:

  - You are about to drop the column `baseSku` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `heelHeight` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `lining` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `materialInnerSole` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `shippingReturns` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `sole` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `upperMaterial` on the `products` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sku]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `brand` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description_en` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description_he` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sku` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title_en` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title_he` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."products_baseSku_key";

-- DropIndex
DROP INDEX "public"."products_slug_key";

-- AlterTable
ALTER TABLE "public"."products" DROP COLUMN "baseSku",
DROP COLUMN "description",
DROP COLUMN "heelHeight",
DROP COLUMN "lining",
DROP COLUMN "materialInnerSole",
DROP COLUMN "name",
DROP COLUMN "shippingReturns",
DROP COLUMN "slug",
DROP COLUMN "sole",
DROP COLUMN "upperMaterial",
ADD COLUMN     "brand" TEXT NOT NULL,
ADD COLUMN     "categories_path" TEXT[],
ADD COLUMN     "categories_path_id" TEXT[],
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'ILS',
ADD COLUMN     "description_en" TEXT NOT NULL,
ADD COLUMN     "description_he" TEXT NOT NULL,
ADD COLUMN     "heelHeight_en" TEXT,
ADD COLUMN     "heelHeight_he" TEXT,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lining_en" TEXT,
ADD COLUMN     "lining_he" TEXT,
ADD COLUMN     "materialInnerSole_en" TEXT,
ADD COLUMN     "materialInnerSole_he" TEXT,
ADD COLUMN     "price" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "salePrice" DOUBLE PRECISION,
ADD COLUMN     "searchKeywords" TEXT[],
ADD COLUMN     "seo_description_en" TEXT,
ADD COLUMN     "seo_description_he" TEXT,
ADD COLUMN     "seo_slug" TEXT,
ADD COLUMN     "seo_title_en" TEXT,
ADD COLUMN     "seo_title_he" TEXT,
ADD COLUMN     "shippingReturns_en" TEXT,
ADD COLUMN     "shippingReturns_he" TEXT,
ADD COLUMN     "sku" TEXT NOT NULL,
ADD COLUMN     "sole_en" TEXT,
ADD COLUMN     "sole_he" TEXT,
ADD COLUMN     "subCategory" TEXT,
ADD COLUMN     "subSubCategory" TEXT,
ADD COLUMN     "title_en" TEXT NOT NULL,
ADD COLUMN     "title_he" TEXT NOT NULL,
ADD COLUMN     "upperMaterial_en" TEXT,
ADD COLUMN     "upperMaterial_he" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "public"."products"("sku");
