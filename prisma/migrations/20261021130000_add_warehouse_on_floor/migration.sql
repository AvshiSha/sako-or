-- "On the floor" as a flag on a drawer, rather than an alternative to one.
--
-- `רצפה` means the floor directly beneath a given drawer, so the drawer number
-- is always required and this is a boolean modifier. It is therefore a plain
-- column with a `false` default: every assignment made before this existed
-- keeps its exact meaning, and nothing needs backfilling.
--
-- Apply AFTER 20261019120000_add_warehouse_locations, whose tables it alters.
--
-- Idempotent, to match the house style and tolerate a re-run on Neon.
--
-- Reminder: do NOT apply this with `npm run db:migrate` (`prisma migrate dev`).
-- This database was built with `db push` and baselined, so `migrate dev` reports
-- drift and offers to reset it. Use:
--   npx prisma db execute --file prisma/migrations/20261021130000_add_warehouse_on_floor/migration.sql
--   npx prisma migrate resolve --applied 20261021130000_add_warehouse_on_floor

----------------------------------------------------------------------------
-- warehouse_locations
----------------------------------------------------------------------------
ALTER TABLE "public"."warehouse_locations"
  ADD COLUMN IF NOT EXISTS "on_floor" BOOLEAN NOT NULL DEFAULT false;

----------------------------------------------------------------------------
-- warehouse_location_history
--
-- Both sides of a change, so moving stock from inside drawer 41 to the floor
-- beneath it is recorded as the real change it is rather than looking like a
-- no-op. `prev_on_floor` is nullable: a first-time assignment has no previous
-- location at all.
----------------------------------------------------------------------------
ALTER TABLE "public"."warehouse_location_history"
  ADD COLUMN IF NOT EXISTS "prev_on_floor" BOOLEAN;

ALTER TABLE "public"."warehouse_location_history"
  ADD COLUMN IF NOT EXISTS "new_on_floor" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: a previous location existed exactly when prev_drawer did, and
-- nothing before this migration could have been on the floor.
UPDATE "public"."warehouse_location_history"
SET "prev_on_floor" = false
WHERE "prev_on_floor" IS NULL AND "prev_drawer" IS NOT NULL;

----------------------------------------------------------------------------
-- Undo the superseded "placement" design, if it was ever applied.
--
-- An earlier version of this feature modelled the floor as a `placement` enum
-- that REPLACED the drawer. That is not what is wanted: the floor is beneath a
-- drawer, so the drawer is still required. This block converts such a database
-- back, and does nothing at all on a database that never saw it -- which is the
-- normal case, since that design was never deployed.
--
-- It refuses rather than guesses if it finds a row it cannot convert: a FLOOR
-- row has no drawer number, and inventing one would send someone to the wrong
-- place.
----------------------------------------------------------------------------
DO $$
DECLARE
  offending text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warehouse_locations'
      AND column_name = 'placement'
  ) THEN
    -- Named, not just counted: the whole point of refusing is that a human has
    -- to decide which drawer each one belongs to, and they need to know which.
    SELECT string_agg(
             "model_code" || ' / colour ' || "color_code" || ' (room ' || "room" ||
             ', route ' || "route" || ')',
             '; ' ORDER BY "model_code", "color_code"
           )
      INTO offending
      FROM "public"."warehouse_locations"
     WHERE "placement"::text = 'FLOOR' AND "drawer" IS NULL;

    IF offending IS NOT NULL THEN
      RAISE EXCEPTION
        'Cannot convert: these locations are on the FLOOR with no drawer number: %. '
        'The floor is now recorded as a flag on a drawer, so each one needs a '
        'drawer (the drawer it sits beneath), or the assignment should be '
        'deleted. See docs/staff-stock-lookup.md, "A superseded design".',
        offending;
    END IF;

    UPDATE "public"."warehouse_locations"
    SET "on_floor" = true
    WHERE "placement"::text = 'FLOOR';

    ALTER TABLE "public"."warehouse_locations"
      DROP CONSTRAINT IF EXISTS "warehouse_locations_placement_drawer_check";
    ALTER TABLE "public"."warehouse_locations" DROP COLUMN "placement";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'warehouse_location_history'
      AND column_name = 'new_placement'
  ) THEN
    UPDATE "public"."warehouse_location_history"
    SET "new_on_floor" = ("new_placement"::text = 'FLOOR'),
        "prev_on_floor" = CASE
          WHEN "prev_placement" IS NULL THEN NULL
          ELSE ("prev_placement"::text = 'FLOOR')
        END;

    -- History rows written under the old design recorded a FLOOR change with no
    -- drawer at all, and `new_drawer` becomes NOT NULL below. Backfill them from
    -- the location they belong to, which by this point carries the drawer the
    -- stock was confirmed to sit beneath.
    --
    -- This does restate those entries in the new vocabulary -- "-> drawer 41,
    -- on floor" where they previously read "-> floor" -- which is a real edit to
    -- an append-only trail. It is the lesser evil: the alternative is a
    -- permanently nullable audit column kept only to accommodate a design that
    -- no longer exists. Timestamp, actor and model/colour are untouched.
    UPDATE "public"."warehouse_location_history" AS h
    SET "new_drawer" = l."drawer"
    FROM "public"."warehouse_locations" AS l
    WHERE h."location_id" = l."id" AND h."new_drawer" IS NULL;

    ALTER TABLE "public"."warehouse_location_history" DROP COLUMN "new_placement";
    ALTER TABLE "public"."warehouse_location_history" DROP COLUMN "prev_placement";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'WarehousePlacement' AND n.nspname = 'public'
  ) THEN
    DROP TYPE "public"."WarehousePlacement";
  END IF;
END $$;

----------------------------------------------------------------------------
-- The drawer is required again, now that the floor no longer replaces it.
----------------------------------------------------------------------------
ALTER TABLE "public"."warehouse_locations"
  ALTER COLUMN "drawer" SET NOT NULL;

ALTER TABLE "public"."warehouse_location_history"
  ALTER COLUMN "new_drawer" SET NOT NULL;
