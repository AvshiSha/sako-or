-- AlterTable
ALTER TABLE "users" ALTER COLUMN "points_balance" TYPE DECIMAL(10,2) USING "points_balance"::DECIMAL(10,2);

-- AlterTable
ALTER TABLE "points" ALTER COLUMN "delta" TYPE DECIMAL(10,2) USING "delta"::DECIMAL(10,2);
