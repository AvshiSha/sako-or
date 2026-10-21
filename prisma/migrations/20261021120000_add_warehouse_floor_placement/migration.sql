-- Floor placement for warehouse locations.
--
-- Some stock sits on the floor of a route rather than in a numbered drawer.
-- That is a real, permanent location, so it is modelled explicitly with a
-- `placement` discriminator rather than encoded as a magic drawer value such as
-- 0 -- which would read as a valid drawer to anyone querying the table.
--
-- Additive and backward compatible: every existing row is a numbered drawer and
-- gets `placement = 'DRAWER'` from the column default, so existing assignments
-- keep working untouched.
--
-- Apply AFTER 20261019120000_add_warehouse_locations. It alters those tables,
-- so it fails loudly rather than silently skipping if they are absent.
--
-- Every statement is idempotent to match the house style and to tolerate a
-- partial or re-run application on Neon. Constraint names are the ones Prisma
-- derives, so a later `prisma migrate` sees no drift.
--
-- Reminder: do NOT apply this with `npm run db:migrate` (`prisma migrate dev`).
-- This database was built with `db push` and baselined, so `migrate dev` reports
-- drift and offers to reset it. Use:
--   npx prisma db execute --file prisma/migrations/20261021120000_add_warehouse_floor_placement/migration.sql
--   npx prisma migrate resolve --applied 20261021120000_add_warehouse_floor_placement

----------------------------------------------------------------------------
-- The placement type
----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'WarehousePlacement' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."WarehousePlacement" AS ENUM ('DRAWER', 'FLOOR');
  END IF;
END $$;

----------------------------------------------------------------------------
-- warehouse_locations
----------------------------------------------------------------------------
ALTER TABLE "public"."warehouse_locations"
  ADD COLUMN IF NOT EXISTS "placement" "public"."WarehousePlacement" NOT NULL DEFAULT 'DRAWER';

-- Floor rows carry no drawer number.
ALTER TABLE "public"."warehouse_locations"
  ALTER COLUMN "drawer" DROP NOT NULL;

-- One stored shape per real location: a drawer placement always has a number,
-- a floor placement never does. Without this the application could write two
-- different rows that mean the same thing, and reads would have to guess.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_locations_placement_drawer_check'
  ) THEN
    ALTER TABLE "public"."warehouse_locations"
    ADD CONSTRAINT "warehouse_locations_placement_drawer_check"
    CHECK (
      ("placement" = 'DRAWER' AND "drawer" IS NOT NULL)
      OR ("placement" = 'FLOOR' AND "drawer" IS NULL)
    );
  END IF;
END $$;

----------------------------------------------------------------------------
-- warehouse_location_history
--
-- The audit trail records both sides of a change, so it needs the placement on
-- both. `prev_placement` is nullable because a first-time assignment has no
-- previous location at all.
----------------------------------------------------------------------------
ALTER TABLE "public"."warehouse_location_history"
  ADD COLUMN IF NOT EXISTS "prev_placement" "public"."WarehousePlacement";

ALTER TABLE "public"."warehouse_location_history"
  ADD COLUMN IF NOT EXISTS "new_placement" "public"."WarehousePlacement" NOT NULL DEFAULT 'DRAWER';

ALTER TABLE "public"."warehouse_location_history"
  ALTER COLUMN "new_drawer" DROP NOT NULL;

-- Backfill: every row written before this migration was a numbered drawer, and
-- a previous location existed exactly when prev_drawer did.
UPDATE "public"."warehouse_location_history"
SET "prev_placement" = 'DRAWER'
WHERE "prev_placement" IS NULL AND "prev_drawer" IS NOT NULL;
