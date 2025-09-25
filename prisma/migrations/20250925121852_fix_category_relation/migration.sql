/*
  Warnings:

  - You are about to drop the column `name` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `categories` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name_en]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name_he]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug_en]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug_he]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name_en` to the `categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name_he` to the `categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug_en` to the `categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug_he` to the `categories` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."categories_name_key";

-- DropIndex
DROP INDEX "public"."categories_slug_key";

-- AlterTable
ALTER TABLE "public"."categories" DROP COLUMN "name",
DROP COLUMN "slug",
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "name_en" TEXT NOT NULL,
ADD COLUMN     "name_he" TEXT NOT NULL,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "slug_en" TEXT NOT NULL,
ADD COLUMN     "slug_he" TEXT NOT NULL,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."newsletter_emails" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "newsletter_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_emails_email_key" ON "public"."newsletter_emails"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_en_key" ON "public"."categories"("name_en");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_he_key" ON "public"."categories"("name_he");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_en_key" ON "public"."categories"("slug_en");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_he_key" ON "public"."categories"("slug_he");

-- AddForeignKey
ALTER TABLE "public"."categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
