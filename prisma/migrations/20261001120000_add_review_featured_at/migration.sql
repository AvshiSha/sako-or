-- Curation flag for the About page review carousel.
--
-- Nullable timestamp rather than a boolean: it gives the carousel a
-- deterministic order (most recently featured first) with no second column, and
-- re-featuring a review moves it back to the front.
--
-- Additive and nullable, so existing rows need no backfill and the deploy is
-- safe to run before the code that reads the column.
ALTER TABLE "reviews" ADD COLUMN "featured_at" TIMESTAMP(3);

-- The carousel reads only non-null rows ordered by this column.
CREATE INDEX "reviews_featured_at_idx" ON "reviews"("featured_at");
