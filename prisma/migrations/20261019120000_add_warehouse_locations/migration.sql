-- Warehouse location lookup: stored drawer assignments, their audit trail, and
-- the short-lived manager-PIN grants that authorize a change.
--
-- Additive only. Three new tables, no existing column touched, so this is safe
-- to apply ahead of the application deploy.
--
-- Every statement is idempotent (IF NOT EXISTS / guarded DO block) to match the
-- house style and to tolerate a partial or re-run application on Neon.
-- Constraint and index names are the ones Prisma derives from the schema, so a
-- later `prisma migrate` sees no drift.

----------------------------------------------------------------------------
-- warehouse_locations
--
-- One row per MODEL + COLOUR. Never per size: every size of a colour shares one
-- drawer. "version" is the optimistic-concurrency token -- a save carries the
-- version it was shown, and a mismatch is reported as a conflict instead of
-- overwriting a newer assignment.
----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."warehouse_locations" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "model_code" TEXT NOT NULL,
  "color_code" TEXT NOT NULL,
  "room"       INTEGER NOT NULL,
  "route"      INTEGER NOT NULL,
  "drawer"     INTEGER NOT NULL,
  "version"    INTEGER NOT NULL DEFAULT 1,
  "updated_by" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- No DB default: `@updatedAt` is written by the Prisma client, and a default
  -- here would read as schema drift on the next `prisma migrate`.
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "warehouse_locations_pkey" PRIMARY KEY ("id")
);

-- The uniqueness rule the whole feature rests on: one location per model/colour.
-- Also the index that serves "all colours of this model", since Postgres can use
-- its leading column -- which is why there is no separate model_code index.
CREATE UNIQUE INDEX IF NOT EXISTS "warehouse_locations_model_code_color_code_key"
  ON "public"."warehouse_locations" ("model_code", "color_code");

----------------------------------------------------------------------------
-- warehouse_location_history
--
-- Append-only. Written in the same transaction as the location itself, so an
-- assignment cannot exist without the entry explaining it. prev_* are NULL for
-- a first-time assignment.
----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."warehouse_location_history" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "location_id" UUID NOT NULL,
  "model_code"  TEXT NOT NULL,
  "color_code"  TEXT NOT NULL,
  "prev_room"   INTEGER,
  "prev_route"  INTEGER,
  "prev_drawer" INTEGER,
  "new_room"    INTEGER NOT NULL,
  "new_route"   INTEGER NOT NULL,
  "new_drawer"  INTEGER NOT NULL,
  "actor_uid"   TEXT,
  "actor_email" TEXT,
  "actor_role"  TEXT NOT NULL,
  "via_pin"     BOOLEAN NOT NULL DEFAULT false,
  "changed_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "warehouse_location_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "warehouse_location_history_model_code_color_code_changed_at_idx"
  ON "public"."warehouse_location_history" ("model_code", "color_code", "changed_at" DESC);

-- ON DELETE RESTRICT, not CASCADE: this is an audit trail, and removing a
-- location must not take its history with it. Nothing in the application deletes
-- locations, so the constraint costs nothing today and refuses the wrong thing
-- if that ever changes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_location_history_location_id_fkey'
  ) THEN
    ALTER TABLE "public"."warehouse_location_history"
    ADD CONSTRAINT "warehouse_location_history_location_id_fkey"
    FOREIGN KEY ("location_id") REFERENCES "public"."warehouse_locations"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END $$;

----------------------------------------------------------------------------
-- staff_edit_grants
--
-- A correct manager PIN mints one of these: a permission scoped to one
-- model/colour, bound to one Firebase session, expiring in minutes and spent by
-- a single successful save.
--
-- In Postgres rather than Firestore specifically so that consuming the grant,
-- writing the location and appending the history row are one transaction.
-- Consumption is a conditional UPDATE whose row count is the check, which is
-- what stops two in-flight saves from both spending the same grant.
----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."staff_edit_grants" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "firebase_uid" TEXT NOT NULL,
  "model_code"   TEXT NOT NULL,
  "color_code"   TEXT NOT NULL,
  "expires_at"   TIMESTAMPTZ(6) NOT NULL,
  "consumed_at"  TIMESTAMPTZ(6),
  "revoked_at"   TIMESTAMPTZ(6),
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_edit_grants_pkey" PRIMARY KEY ("id")
);

-- Serves both the per-session validity check and the revoke-on-sign-out sweep.
CREATE INDEX IF NOT EXISTS "staff_edit_grants_firebase_uid_expires_at_idx"
  ON "public"."staff_edit_grants" ("firebase_uid", "expires_at");
