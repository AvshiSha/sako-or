/*
  Warnings:

  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `users` table. All the data in the column will be lost.
  - The `id` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `color_variant_images` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `color_variant_sizes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `color_variants` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[firebase_uid]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Made the column `bogoBuyQuantity` on table `coupons` required. This step will fail if there are existing NULL values in that column.
  - Made the column `bogoGetQuantity` on table `coupons` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updated_at` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."color_variant_images" DROP CONSTRAINT "color_variant_images_colorVariantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."color_variant_sizes" DROP CONSTRAINT "color_variant_sizes_colorVariantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."color_variants" DROP CONSTRAINT "color_variants_productId_fkey";

-- AlterTable
ALTER TABLE "public"."coupons" ALTER COLUMN "bogoBuyQuantity" SET NOT NULL,
ALTER COLUMN "bogoGetQuantity" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."products" ADD COLUMN     "colorVariants" JSONB DEFAULT '{}';

-- AlterTable
ALTER TABLE "public"."users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "name",
DROP COLUMN "password",
DROP COLUMN "updatedAt",
ADD COLUMN     "address_apt" TEXT,
ADD COLUMN     "address_floor" TEXT,
ADD COLUMN     "address_street" TEXT,
ADD COLUMN     "address_street_number" TEXT,
ADD COLUMN     "auth_provider" TEXT,
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firebase_uid" TEXT,
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "is_delete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_newsletter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "password_changed_at" TIMESTAMPTZ(6),
ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "points_balance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ALTER COLUMN "email" DROP NOT NULL,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "public"."color_variant_images";

-- DropTable
DROP TABLE "public"."color_variant_sizes";

-- DropTable
DROP TABLE "public"."color_variants";

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "public"."users"("firebase_uid");
