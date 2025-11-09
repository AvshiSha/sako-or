PS C:\Users\user\sako-or> npx prisma migrate deploy
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "neondb", schema "public" at "ep-floral-breeze-adcmnto1-pooler.c-2.us-east-1.aws.neon.tech"

8 migrations found in prisma/migrations

Applying migration `20250930110000_add_order_email_fields`
Error: P3018

A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve

Migration name: 20250930110000_add_order_email_fields

Database error code: 42701

Database error:
ERROR: column "emailMessageId" of relation "orders" already exists

DbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42701), message: "column \"emailMessageId\" of relation \"orders\" already exists", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("tablecmds.c"), line: Some(7478), routine: Some("check_for_column_name_collision") }


PS C:\Users\user\sako-or> npx prisma migrate dev --name add_coupons_system
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "neondb", schema "public" at "ep-floral-breeze-adcmnto1-pooler.c-2.us-east-1.aws.neon.tech"

Error: P3006

Migration `20241016000000_add_order_email_fields` failed to apply cleanly to the shadow database.
Error code: P1014
Error:
The underlying table for model `orders` does not exist.
-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('percent_all', 'percent_specific', 'fixed', 'bogo');

-- AlterTable
ALTER TABLE "public"."orders"
ADD COLUMN "subtotal" DOUBLE PRECISION,
ADD COLUMN "discountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill subtotal for existing orders
UPDATE "public"."orders"
SET "subtotal" = COALESCE("subtotal", "total");

-- CreateTable
CREATE TABLE "public"."coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_he" TEXT NOT NULL,
    "description_en" TEXT,
    "description_he" TEXT,
    "discountType" "CouponDiscountType" NOT NULL,
    "discountValue" DOUBLE PRECISION,
    "minCartValue" DOUBLE PRECISION DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usageLimitPerUser" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "autoApply" BOOLEAN NOT NULL DEFAULT false,
    "eligibleProducts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "eligibleCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "bogoBuyQuantity" INTEGER DEFAULT 1,
    "bogoGetQuantity" INTEGER DEFAULT 1,
    "bogoEligibleSkus" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coupon_redemptions" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userIdentifier" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "coupon_redemptions_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "public"."coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "public"."coupons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_couponId_userIdentifier_key" ON "public"."coupon_redemptions"("couponId", "userIdentifier");

-- CreateTable
CREATE TABLE "public"."order_coupons" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "couponId" TEXT,
    "code" TEXT NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL,
    "discountType" "CouponDiscountType" NOT NULL,
    "stackable" BOOLEAN NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_coupons_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_coupons_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "public"."coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "order_coupons_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "order_coupons_code_idx" ON "public"."order_coupons"("code");

