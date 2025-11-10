-- AlterTable
ALTER TABLE "coupons"
  ADD COLUMN "bogoBuySkus" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "bogoGetSkus" TEXT[] DEFAULT ARRAY[]::TEXT[];

