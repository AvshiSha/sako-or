-- Drop legacy password fields. End-user auth is OTP-only; admin auth uses Firebase directly.
ALTER TABLE "public"."users"
  DROP COLUMN IF EXISTS "password_hash",
  DROP COLUMN IF EXISTS "password_changed_at";


