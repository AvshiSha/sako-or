-- Freeze the delivery address against the order it belongs to.
--
-- Until now an order carried no address at all. The confirmation email resolved one
-- by looking up the most recent `checkouts` row for the customer's email address,
-- which is not necessarily the address that order was shipped to, and which produced
-- a blank address entirely when that row was never written.
--
-- All columns are nullable and nothing is backfilled:
--   * pickup orders have no delivery address by definition;
--   * orders placed before this migration have none recorded, and inferring one from
--     a later checkout or from the customer's current profile would write a plausible
--     guess into a shipping address. A visible blank is the safer failure.
--
-- Purely additive, so existing code that does not know these columns is unaffected.
ALTER TABLE "orders"
  ADD COLUMN "shipping_city"         TEXT,
  ADD COLUMN "shipping_street_name"  TEXT,
  ADD COLUMN "shipping_street_number" TEXT,
  ADD COLUMN "shipping_floor"        TEXT,
  ADD COLUMN "shipping_apartment"    TEXT,
  ADD COLUMN "shipping_zip"          TEXT,
  ADD COLUMN "shipping_notes"        TEXT,
  ADD COLUMN "customer_id_number"    TEXT;
