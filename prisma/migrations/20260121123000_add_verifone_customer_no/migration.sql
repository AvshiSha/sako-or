-- Add Verifone customer number column to users table
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "verifone_customer_no" TEXT;

