-- Add Verifone invoice tracking fields to orders table
ALTER TABLE "orders"
ADD COLUMN IF NOT EXISTS "verifone_invoice_status" TEXT,
ADD COLUMN IF NOT EXISTS "verifone_invoice_no" TEXT,
ADD COLUMN IF NOT EXISTS "verifone_invoice_request" TEXT,
ADD COLUMN IF NOT EXISTS "verifone_invoice_response" TEXT,
ADD COLUMN IF NOT EXISTS "verifone_invoice_attempted_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "verifone_invoice_synced_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "verifone_invoice_error" TEXT;
