-- Hebrew search improvements: pg_trgm fuzzy matching + normalized search columns

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION normalize_hebrew_search(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(
    regexp_replace(
      lower(
        regexp_replace(
          translate(
            regexp_replace(coalesce(input, ''), '[\u0591-\u05C7]', '', 'g'),
            'םןץףך',
            'מנצפכ'
          ),
          '[''"״׳\-–—]',
          ' ',
          'g'
        )
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

-- Immutable text[] → space-separated string (array_to_string is STABLE, unusable in generated cols)
CREATE OR REPLACE FUNCTION immutable_text_array_flat(arr text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(
    both '{}'
    from replace(
      replace(coalesce(arr::text, ''), ',', ' '),
      '"',
      ''
    )
  );
$$;

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "colors_search_norm" TEXT NOT NULL DEFAULT '';

    UPDATE "products"
    SET "colors_search_norm" = COALESCE(
      (
        SELECT string_agg(DISTINCT val, ' ' ORDER BY val)
        FROM (
          SELECT normalize_hebrew_search(j.key) AS val
          FROM jsonb_each(COALESCE("colorVariants", '{}'::jsonb)) AS j(key, value)
          UNION
          SELECT normalize_hebrew_search(j.value->>'colorSlug')
          FROM jsonb_each(COALESCE("colorVariants", '{}'::jsonb)) AS j(key, value)
          WHERE j.value->>'colorSlug' IS NOT NULL
          UNION
          SELECT normalize_hebrew_search(j.value->>'colorName')
          FROM jsonb_each(COALESCE("colorVariants", '{}'::jsonb)) AS j(key, value)
          WHERE j.value->>'colorName' IS NOT NULL
        ) t
        WHERE val IS NOT NULL AND val <> ''
      ),
      ''
    );

    ALTER TABLE "products" DROP COLUMN IF EXISTS "title_search_norm";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "category_search_norm";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "sku_search_norm";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "description_search_norm";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "search_blob_norm";

    ALTER TABLE "products"
    ADD COLUMN "title_search_norm" TEXT
    GENERATED ALWAYS AS (
      normalize_hebrew_search(
        coalesce("title_he", '') || ' ' || coalesce("title_en", '')
      )
    ) STORED;

    ALTER TABLE "products"
    ADD COLUMN "category_search_norm" TEXT
    GENERATED ALWAYS AS (
      normalize_hebrew_search(
        coalesce("category_he", '') || ' ' ||
        coalesce("subCategory_he", '') || ' ' ||
        coalesce("subSubCategory_he", '') || ' ' ||
        coalesce(category, '') || ' ' ||
        coalesce("subCategory", '') || ' ' ||
        coalesce("subSubCategory", '')
      )
    ) STORED;

    ALTER TABLE "products"
    ADD COLUMN "sku_search_norm" TEXT
    GENERATED ALWAYS AS (
      normalize_hebrew_search(coalesce(sku, ''))
    ) STORED;

    ALTER TABLE "products"
    ADD COLUMN "description_search_norm" TEXT
    GENERATED ALWAYS AS (
      normalize_hebrew_search(
        coalesce("description_he", '') || ' ' || coalesce("description_en", '')
      )
    ) STORED;

    -- search_blob_norm: inline all expressions (PG forbids referencing other generated cols)
    ALTER TABLE "products"
    ADD COLUMN "search_blob_norm" TEXT
    GENERATED ALWAYS AS (
      trim(
        regexp_replace(
          normalize_hebrew_search(
            coalesce("title_he", '') || ' ' || coalesce("title_en", '')
          ) || ' ' ||
          normalize_hebrew_search(
            coalesce("category_he", '') || ' ' ||
            coalesce("subCategory_he", '') || ' ' ||
            coalesce("subSubCategory_he", '') || ' ' ||
            coalesce(category, '') || ' ' ||
            coalesce("subCategory", '') || ' ' ||
            coalesce("subSubCategory", '')
          ) || ' ' ||
          normalize_hebrew_search(coalesce(sku, '')) || ' ' ||
          normalize_hebrew_search(
            coalesce("description_he", '') || ' ' || coalesce("description_en", '')
          ) || ' ' ||
          normalize_hebrew_search(coalesce(brand, '')) || ' ' ||
          normalize_hebrew_search(immutable_text_array_flat("searchKeywords")) || ' ' ||
          normalize_hebrew_search(immutable_text_array_flat(tags)) || ' ' ||
          coalesce(colors_search_norm, ''),
          '\s+',
          ' ',
          'g'
        )
      )
    ) STORED;

    DROP INDEX IF EXISTS "products_search_blob_norm_gin";
    CREATE INDEX "products_search_blob_norm_gin"
    ON "products"
    USING GIN ("search_blob_norm" gin_trgm_ops);

    DROP INDEX IF EXISTS "products_search_vector_gin";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "search_vector";

    ALTER TABLE "products"
    ADD COLUMN "search_vector" tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce("title_en", '')), 'A') ||
      setweight(to_tsvector('english', coalesce("description_en", '')), 'B') ||
      setweight(to_tsvector('simple', coalesce("title_he", '')), 'A') ||
      setweight(to_tsvector('simple', coalesce("description_he", '')), 'B') ||
      setweight(to_tsvector('simple', coalesce("sku", '')), 'A') ||
      setweight(to_tsvector('english', coalesce("upperMaterial_en", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("materialInnerSole_en", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("lining_en", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("sole_en", '')), 'B') ||
      setweight(to_tsvector('english', coalesce("heelHeight_en", '')), 'B') ||
      setweight(to_tsvector('simple', coalesce("upperMaterial_he", '')), 'B') ||
      setweight(to_tsvector('simple', coalesce("materialInnerSole_he", '')), 'B') ||
      setweight(to_tsvector('simple', coalesce("lining_he", '')), 'B') ||
      setweight(to_tsvector('simple', coalesce("sole_he", '')), 'B') ||
      setweight(to_tsvector('simple', coalesce("heelHeight_he", '')), 'B') ||
      setweight(to_tsvector('simple', coalesce("category", '')), 'A') ||
      setweight(to_tsvector('simple', coalesce("subCategory", '')), 'A') ||
      setweight(to_tsvector('simple', coalesce("subSubCategory", '')), 'A') ||
      setweight(to_tsvector('simple', coalesce("category_he", '')), 'A') ||
      setweight(to_tsvector('simple', coalesce("subCategory_he", '')), 'A') ||
      setweight(to_tsvector('simple', coalesce("subSubCategory_he", '')), 'A') ||
      setweight(to_tsvector('simple', coalesce("brand", '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(immutable_text_array_flat("searchKeywords"), '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(immutable_text_array_flat(tags), '')), 'B') ||
      setweight(to_tsvector('simple', coalesce("colors_search_norm", '')), 'A')
    ) STORED;

    CREATE INDEX "products_search_vector_gin"
    ON "products"
    USING GIN ("search_vector");
  END IF;
END $$;
