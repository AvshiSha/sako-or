-- AlterTable
ALTER TABLE "users" ADD COLUMN "phone_verified_at" TIMESTAMPTZ(6),
ADD COLUMN "signup_completed_at" TIMESTAMPTZ(6);

