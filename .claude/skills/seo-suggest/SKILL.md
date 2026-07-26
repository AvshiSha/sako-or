---
name: seo-suggest
description: Generate SEO title, meta description, focus/secondary keyword suggestions for a SAKO-OR product (new or existing), grounded in real Semrush keyword data rather than guessed keywords.
---

# Product SEO Suggestions

Given a product identifier (SKU or Firestore product ID), or a plain description of a not-yet-created product, produce grounded `he`/`en` SEO suggestions: focus keyword, secondary keywords, meta title, meta description.

**Hard rule: never invent keyword popularity.** Every keyword suggested must come from a Semrush lookup performed in this run, not from general knowledge or pattern-matching on the product name.

## Steps

1. **Load the product's structured data.**
   - Existing product: look it up with a throwaway script using `lib/firebase.ts`'s `productService` (same pattern as `scripts/`), e.g.:
     ```
     npx tsx -e "
     import 'dotenv/config'
     import { productService } from './lib/firebase'
     ;(async () => {
       const p = (await productService.getProductBySku('<SKU>')) ?? (await productService.getProductById('<ID>'))
       console.log(JSON.stringify(p, null, 2))
     })()
     "
     ```
     The `dotenv/config` import matters — `lib/firebase.ts` reads `NEXT_PUBLIC_FIREBASE_*` from `process.env`, which only happens automatically inside Next's own runtime (see `scripts/script-prisma.ts` for the same pattern). Try SKU first, then id. If neither resolves, ask the user which one they meant.
   - Read the result through the lens of `getStructuredProductData` in `lib/product-seo.ts` — category, subcategory, product type, brand, main color, material, closure/heel/toe details, and shoe-fit facts (`sizeFit`, `footWidthFit`, fit notes). You can reason over the raw product JSON directly; the mapping in that file shows exactly which fields matter.
   - New/draft product (not saved yet): ask the user for whatever they have — working title, category/subcategory, brand, material, color, fit notes — and use that as the structured data instead of hitting the DB.

2. **Derive seed terms**, separately for English and Hebrew: product type + category + subcategory, brand, main color, material, and any standout shoe-fit trait (e.g. "wide fit", "narrow toe box"). Keep seeds specific to this product, not generic ("women's shoes").

3. **Get real keyword data from Semrush** for each seed:
   - English seeds → `keyword_research` (and `shopping_research` when the term is clearly a shoppable product query) against database `us` by default (ask if the target market is elsewhere).
   - Hebrew/Israel seeds → the same tools against database `il`.
   - Pull search volume, competition, and related/long-tail suggestions for each seed.

4. **Select only from what Semrush actually returned** — don't top up with keywords it didn't surface:
   - One focus keyword per locale: best balance of volume and relevance (reject high-volume terms that are off-topic for this specific product).
   - 3–5 secondary keywords per locale from the related/long-tail results.

5. **Draft copy that fits the house length rules** in `lib/seo-length.ts`: meta title 50–60 characters, meta description 140–160 characters, for both `he` and `en`. Each must naturally include its locale's focus keyword and describe the actual product (color, material, fit) — no generic filler, no claims not present in the product's own data.

6. **Present the suggestion before touching anything else**: for each locale, the focus keyword with its volume, the secondary keywords with volumes, the meta title with character count, the meta description with character count. Wait for the user to confirm or adjust.

7. **Apply only if the user confirms:**
   - Existing product: `GET /api/products/{id}` against the running dev server (default `http://localhost:3000` — confirm if unsure), merge the confirmed values into the `seo` block only (`title_en`, `title_he`, `description_en`, `description_he`, `focusKeyword_en`, `focusKeyword_he`, `secondaryKeywords_en`, `secondaryKeywords_he`; leave `slug` and everything else untouched unless asked), then `PUT /api/products/{id}` with the full merged payload — that endpoint requires the whole product object, not a partial patch.
   - New/draft product: hand the values back for the admin to paste into the SEO section of the new-product form ([ProductSeoSection.tsx](../../../app/admin/products/_components/ProductSeoSection.tsx)) — don't write anywhere, since the product doesn't exist yet.

## Notes
- `lib/product-seo.ts`'s `getStructuredProductData` is the intended single source of product facts for SEO tooling — reuse its field mapping rather than re-deriving facts ad hoc.
- `lib/seo-length.ts` ranges (`SEO_TITLE_RANGE`, `META_DESCRIPTION_RANGE`) are advisory in the admin UI but the whole point of this skill is to land inside them.
- The live site reads `product.seo.*` at request time via `lib/seo.ts` (see `app/[lng]/product/[baseSku]/[colorSlug]/layout.tsx`) — writing to Firestore through the API above is enough for changes to show up; no separate sync step is needed for this field.
