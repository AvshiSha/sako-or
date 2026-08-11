-- Additive-only migration: the review-reward state machine.
--
-- Reviewing earns the customer loyalty points, but points can only be credited on a
-- registered account, and Verifone (the source of truth for balances) exposes no
-- points-write API — so the credit is fulfilled by hand through /admin/reviews.
-- These columns are the state of that obligation: who is owed, how much, whether it
-- has been paid, and what went wrong if not.
--
-- `reward_status` defaults to 'not_eligible' rather than 'pending' on purpose: the
-- overwhelming majority of orders are guest checkouts with no account to credit, so
-- "nothing owed" is the correct resting state for a backfilled row. Existing reviews
-- therefore do not silently appear in the payout queue.

DO $$
BEGIN
  IF to_regclass('public.reviews') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "reward_status"         TEXT NOT NULL DEFAULT 'not_eligible';
  ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "reward_points"         INTEGER;
  ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "reward_credited_at"    TIMESTAMP(3);
  ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "reward_transaction_id" TEXT;
  ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "reward_error"          TEXT;

  CREATE INDEX IF NOT EXISTS "reviews_reward_status_idx" ON "reviews" ("reward_status");

  -- Reviews already paid out before this migration existed are 'credited', so the
  -- admin queue reflects reality on day one instead of re-listing settled rows.
  UPDATE "reviews"
     SET "reward_status"      = 'credited',
         "reward_credited_at" = "points_awarded_at",
         "reward_transaction_id" = "points_awarded_by"
   WHERE "points_awarded_at" IS NOT NULL
     AND "reward_status" = 'not_eligible';
END $$;
