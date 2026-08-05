-- Additive-only migration: carrier shipment tracking (HFD PUSH webhook) plus the
-- post-delivery review-request scheduling table. Creates four new tables and touches
-- no existing column, so it is safe to apply ahead of the application deploy.
--
-- Every statement is idempotent (IF NOT EXISTS) to match the house style and to
-- tolerate partial/re-run application on Neon.

DO $$
BEGIN
  -- Guard on "orders": the shipment/review tables carry FKs into it, so skip the
  -- whole migration rather than fail if it is somehow absent.
  IF to_regclass('public.orders') IS NULL THEN
    RETURN;
  END IF;

  ----------------------------------------------------------------------------
  -- shipments
  ----------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS "shipments" (
    "id"                       TEXT NOT NULL,
    "order_id"                 TEXT NOT NULL,
    "order_number"             TEXT NOT NULL,
    "provider"                 TEXT NOT NULL DEFAULT 'hfd',
    "provider_shipment_no"     TEXT NOT NULL,
    "provider_ref"             TEXT,
    "provider_random_id"       TEXT,
    "is_delivered"             BOOLEAN NOT NULL DEFAULT false,
    "is_returned_to_sender"    BOOLEAN NOT NULL DEFAULT false,
    "is_canceled"              BOOLEAN NOT NULL DEFAULT false,
    "delivered_at"             TIMESTAMP(3),
    "returned_at"              TIMESTAMP(3),
    "canceled_at"              TIMESTAMP(3),
    "last_status_code"         TEXT,
    "last_status_desc"         TEXT,
    "last_status_at"           TIMESTAMP(3),
    "last_webhook_received_at" TIMESTAMP(3),
    "raw_latest_payload"       JSONB,
    "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
  );

  -- Added separately from CREATE TABLE so this migration is still correct when
  -- re-run against a database where the table already exists.
  ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "is_returned_to_sender" BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "returned_at" TIMESTAMP(3);

  -- Idempotency key for webhook redelivery. provider_shipment_no is NOT NULL on
  -- purpose: Postgres treats NULLs as distinct in a unique index, so a nullable
  -- column would silently allow duplicate rows for the same parcel.
  CREATE UNIQUE INDEX IF NOT EXISTS "shipments_provider_provider_shipment_no_key"
    ON "shipments" ("provider", "provider_shipment_no");
  CREATE INDEX IF NOT EXISTS "shipments_order_id_idx"      ON "shipments" ("order_id");
  CREATE INDEX IF NOT EXISTS "shipments_order_number_idx"  ON "shipments" ("order_number");
  CREATE INDEX IF NOT EXISTS "shipments_is_delivered_delivered_at_idx"
    ON "shipments" ("is_delivered", "delivered_at");

  ----------------------------------------------------------------------------
  -- shipment_events
  ----------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS "shipment_events" (
    "id"          TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "status_code" TEXT NOT NULL,
    "status_desc" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "location"    TEXT,
    "city"        TEXT,
    "raw"         JSONB,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
  );

  -- Replaying an identical webhook payload must insert nothing.
  CREATE UNIQUE INDEX IF NOT EXISTS "shipment_events_shipment_id_status_code_occurred_at_key"
    ON "shipment_events" ("shipment_id", "status_code", "occurred_at");
  CREATE INDEX IF NOT EXISTS "shipment_events_shipment_id_occurred_at_idx"
    ON "shipment_events" ("shipment_id", "occurred_at" DESC);

  ----------------------------------------------------------------------------
  -- webhook_events (raw forensic log — intentionally has NO foreign key)
  ----------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS "webhook_events" (
    "id"           TEXT NOT NULL,
    "provider"     TEXT NOT NULL,
    "received_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auth_outcome" TEXT NOT NULL,
    "status"       TEXT NOT NULL,
    "order_number" TEXT,
    "payload"      JSONB NOT NULL,
    "headers"      JSONB,
    "error"        TEXT,
    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
  );

  ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "headers" JSONB;

  CREATE INDEX IF NOT EXISTS "webhook_events_provider_received_at_idx"
    ON "webhook_events" ("provider", "received_at" DESC);
  CREATE INDEX IF NOT EXISTS "webhook_events_order_number_idx" ON "webhook_events" ("order_number");
  CREATE INDEX IF NOT EXISTS "webhook_events_status_idx"       ON "webhook_events" ("status");

  ----------------------------------------------------------------------------
  -- review_requests
  ----------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS "review_requests" (
    "id"              TEXT NOT NULL,
    "order_id"        TEXT NOT NULL,
    "order_number"    TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'pending',
    "scheduled_for"   TIMESTAMP(3) NOT NULL,
    "attempts"        INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3),
    "sent_at"         TIMESTAMP(3),
    "channels"        JSONB,
    "last_error"      TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id")
  );

  -- One review request per order, forever. This constraint IS the double-schedule guard.
  CREATE UNIQUE INDEX IF NOT EXISTS "review_requests_order_id_key"
    ON "review_requests" ("order_id");
  CREATE INDEX IF NOT EXISTS "review_requests_status_scheduled_for_idx"
    ON "review_requests" ("status", "scheduled_for");

  ----------------------------------------------------------------------------
  -- Foreign keys (added separately so re-runs do not fail on duplicates)
  ----------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shipments_order_id_fkey') THEN
    ALTER TABLE "shipments"
      ADD CONSTRAINT "shipments_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shipment_events_shipment_id_fkey') THEN
    ALTER TABLE "shipment_events"
      ADD CONSTRAINT "shipment_events_shipment_id_fkey"
      FOREIGN KEY ("shipment_id") REFERENCES "shipments" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_requests_order_id_fkey') THEN
    ALTER TABLE "review_requests"
      ADD CONSTRAINT "review_requests_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
