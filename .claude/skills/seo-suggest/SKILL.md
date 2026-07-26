---
name: seo-suggest
description: Generate the full SEO/content package for a SAKO-OR product (new or existing) — short/full names and descriptions, image alt text, SEO title/meta description, focus/secondary keywords, and Hebrew site-search keywords — grounded in real Semrush keyword data rather than guessed keywords.
---

# Product SEO Suggestions

Given a product identifier (SKU or Firestore product ID), or a plain description of a not-yet-created product, produce grounded `he`/`en` suggestions for all 16 fields below, then offer to apply them.

**Hard rule: never invent keyword popularity.** Every keyword/volume claim (items 12–16) must come from a Semrush lookup performed in this run, not from general knowledge or pattern-matching on the product name. Copy fields (items 1–7) must describe only facts present in the product's own data — no invented claims — but are your own writing, not a Semrush lookup.

## The 16 fields

| # | Field | Product data location | Grounding |
|---|---|---|---|
| 1 | Short Product Name (English) | `shortTitle_en` | Copy, keyword-aware |
| 2 | Short Product Name (Hebrew) | `shortTitle_he` | Copy, keyword-aware |
| 3 | Short Description (English) | `shortDescription_en` | Copy, keyword-aware |
| 4 | Short Description (Hebrew) | `shortDescription_he` | Copy, keyword-aware |
| 5 | Full Description (English) * | `description_en` | Copy, keyword-aware |
| 6 | Full Description (Hebrew) * | `description_he` | Copy, keyword-aware |
| 7 | Image alt text (EN + HE) | `colorVariants[colorSlug].imageDetails[].altEn` / `.altHe` (keyed by image URL, see `lib/product-images.ts`) | Copy, accessibility-first |
| 8 | SEO Title (English) | `seo.title_en` | Semrush-grounded |
| 9 | SEO Title (Hebrew) | `seo.title_he` | Semrush-grounded |
| 10 | Meta Description (English) | `seo.description_en` | Semrush-grounded |
| 11 | Meta Description (Hebrew) | `seo.description_he` | Semrush-grounded |
| 12 | Focus Keyword (English) | `seo.focusKeyword_en` | Semrush-grounded |
| 13 | Focus Keyword (Hebrew) | `seo.focusKeyword_he` | Semrush-grounded |
| 14 | Secondary Keywords (English) | `seo.secondaryKeywords_en` | Semrush-grounded |
| 15 | Secondary Keywords (Hebrew) | `seo.secondaryKeywords_he` | Semrush-grounded |
| 16 | Search Keywords (Hebrew) | top-level `searchKeywords` (flat array) | Semrush-informed, site-search recall |

\* Full descriptions are required fields on the product (non-empty), unlike the other copy fields.

## Steps

### 1. Load the product's structured data

- **Existing product**: look it up with a throwaway script using `lib/firebase.ts`'s `productService` (same pattern as `scripts/`), e.g.:
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
  - Read the result through the lens of `getStructuredProductData` in `lib/product-seo.ts` for title/description/classification/specs/shoeFit/seo — category, subcategory, product type, brand, main color, material, closure/heel/toe details, fit facts.
  - For item 7 (alt text), also look at the raw product's `colorVariants[*].images` (URLs) and `colorVariants[*].imageDetails` (existing `altEn`/`altHe`/`type`/`order` per URL) — `getStructuredProductData` doesn't carry these, so read them straight off the fetched product JSON. Group by color variant; note each image's `type` if already set (e.g. `main`, `side`, `sole`, `detail` — see `lib/product-enums.ts`'s `PRODUCT_IMAGE_TYPE_OPTIONS`) since that tells you what the image actually shows.
  - Also read the existing `searchKeywords` (flat array) and, if you want to see what's already auto-covered, note that `generated_search_keywords` (from `lib/build-product-search-keywords.ts`) already covers category/brand/material/color/size terms automatically — item 16 should add *manual, human-phrased* terms on top of that, not duplicate it.
- **New/draft product (not saved yet)**: ask the user for whatever they have — working title, category/subcategory, brand, material, color, fit notes, and (if relevant) a description of what images are planned (e.g. "front, side, sole, on-model"). Use that as the structured data instead of hitting the DB. There are no real image URLs yet, so item 7 becomes generic per-view-type templates instead of per-URL entries.

### 2. Derive seed terms

Separately for English and Hebrew: product type + category + subcategory, brand, main color, material, and any standout shoe-fit trait (e.g. "wide fit", "narrow toe box"). Keep seeds specific to this product, not generic ("women's shoes").

### 3. Get real keyword data from Semrush

- English seeds → `keyword_research` (`phrase_these` for a quick batch check, `phrase_related` for expansion; `shopping_research` when the term is clearly a shoppable product query) against database `us` by default (ask if the target market is elsewhere).
- Hebrew/Israel seeds → the same tools against database `il`.
- Pull search volume, competition, and related/long-tail suggestions for each seed. Drop any seed Semrush returns no data for rather than guessing a volume for it.

### 4. Select keywords (items 12–15) — only from what Semrush actually returned

- One focus keyword per locale (12, 13): best balance of volume and relevance (reject high-volume terms that are off-topic for this specific product).
- 3–5 secondary keywords per locale (14, 15) from the related/long-tail results.

### 5. Draft SEO meta copy (items 8–11)

Fit the house length rules in `lib/seo-length.ts`: meta title 50–60 characters, meta description 140–160 characters, for both `he` and `en`. Each must naturally include its locale's focus keyword and describe the actual product (color, material, fit) — no generic filler, no unstated claims.

### 6. Draft product copy (items 1–6)

These are copywriting, not Semrush lookups, but should read naturally with the focus keyword and 1–2 secondary keywords worked in where they fit — never keyword-stuffed.

- **Short name (1, 2)**: a few words, used on product cards where the full title is too long (see `ProductBasicInformationSection.tsx`). No hard length limit in code, but keep it noticeably shorter than the full title — aim ~15–30 characters, e.g. "Gray Leather Sneakers" / "סניקרס עור אפור".
- **Short description (3, 4)**: one or two sentences for listing/preview cards. Lead with the focus keyword's concept and the single most distinctive fact (material or color).
- **Full description (5, 6)**: a few sentences (3–5), covering material, lining, sole, closure, fit — pull every fact from the product's own specs/shoeFit data so nothing is invented. Work in the focus keyword once near the start and 1–2 secondary keywords naturally later. No formal character range, but don't pad — stop once the real facts are covered.

### 7. Draft image alt text (item 7)

Accessibility-first, not keyword-stuffed — screen readers and Google Images both penalize repetitive stuffing across a gallery.

- **Existing product with real images**: one alt text per image URL per locale, differentiated by the image's `type`/view (main, front, side, sole, detail, on_model, etc. — see `PRODUCT_IMAGE_TYPE_OPTIONS`). Pattern: `<product short name> – <view/angle> – <color>`, e.g. EN "Gray leather sneakers – side view", HE "סניקרס עור אפור – מבט מהצד". Only the *first* (main) image should include the focus keyword; the rest just need to accurately describe what's shown.
- **New/draft product with no images yet**: give templates keyed by likely view type (main, side, sole, detail, on-model) that the admin can drop in once images are uploaded, using the same pattern.

### 8. Draft Hebrew site-search keywords (item 16)

This is **not** a meta-keywords tag — it feeds the site's own Hebrew full-text search matching (`lib/search-products.ts`, `lib/meilisearch.ts`), so the goal is *recall of real customer phrasing*, not Google search volume. Since `generated_search_keywords` already auto-derives category/brand/material/color/size terms (see `lib/build-product-search-keywords.ts`), item 16 should add what that auto-generation *can't* infer:
- Alternate spellings/transliterations customers might type (e.g. "סניקרס" vs "סניקערס" vs "sneakers" in Hebrew characters).
- Colloquial or synonym terms surfaced by the Hebrew (`il`) Semrush related-keyword results that aren't already category/material/color words (e.g. a style nickname).
- Common misspellings only if Semrush's related-keyword data actually shows meaningful volume for them — don't invent typos.

Keep this list short (5–10 terms) and free of exact duplicates of the auto-generated set.

### 9. Present everything as markdown tables — always, no exceptions

Never reply with prose paragraphs or bullet lists for the results. Always output four markdown tables, in this order, using these exact column sets. Fill in real values — don't leave placeholders.

**1. Names & Descriptions**

| # | Field | English | Hebrew |
|---|---|---|---|
| 1–2 | Short Product Name (H2) | ... | ... |
| 3–4 | Short Description | ... | ... |
| 5–6 | Full Description * | ... | ... |

**2. Image Alt Text**

| Image / View | Alt Text (English) | Alt Text (Hebrew) |
|---|---|---|
| Main | ... | ... |
| Side | ... | ... |
| Sole | ... | ... |
| (one row per view type identified in step 1/7) | | |

**3. SEO Meta**

| Field | Value | Length |
|---|---|---|
| SEO Title (English) | ... | NN/60 chars |
| SEO Title (Hebrew) | ... | NN/60 chars |
| Meta Description (English) | ... | NN/160 chars |
| Meta Description (Hebrew) | ... | NN/160 chars |

**4. Keywords**

| Type | English | Volume | Hebrew | Volume |
|---|---|---|---|---|
| Focus Keyword | ... | N,NNN/mo | ... | N,NNN/mo |
| Secondary Keyword 1 | ... | N,NNN/mo | ... | N,NNN/mo |
| Secondary Keyword 2 | ... | N,NNN/mo | ... | N,NNN/mo |
| ... | | | | |
| Search Keywords (Hebrew, site search) | — | — | comma-separated list | — |

Put any caveats (e.g. "no Semrush data for X combo, so Y used instead") as a short note *below* the tables, not inside cells. Wait for the user to confirm or adjust before writing anywhere.

### 10. Apply only if the user confirms

- **Existing product**: `GET /api/products/{id}` against the running dev server (default `http://localhost:3000` — confirm if unsure), merge the confirmed values into the product payload, then `PUT /api/products/{id}` with the full merged payload — that endpoint requires the whole product object, not a partial patch. Field mapping:
  - Items 1–6 → top-level `shortTitle_en`, `shortTitle_he`, `shortDescription_en`, `shortDescription_he`, `description_en`, `description_he`.
  - Item 7 → for each color variant, upsert entries in `colorVariants[colorSlug].imageDetails` keyed by the image's existing `url` (preserve any `type`/`order` already set; add/update only `altEn`/`altHe`).
  - Items 8–11, 12–15 → the `seo` block (`title_en`, `title_he`, `description_en`, `description_he`, `focusKeyword_en`, `focusKeyword_he`, `secondaryKeywords_en`, `secondaryKeywords_he`). Leave `slug` and everything else in `seo` untouched unless asked.
  - Item 16 → top-level `searchKeywords`, merged with (not replacing) whatever manual terms are already there, deduplicated.
- **New/draft product**: hand all 16 values back for the admin to paste into the relevant sections of the new-product form — [ProductBasicInformationSection.tsx](../../../app/admin/products/_components/ProductBasicInformationSection.tsx) for items 1–6, the per-image alt text fields ([ProductImageSeoFields.tsx](../../../app/admin/products/_components/ProductImageSeoFields.tsx)) for item 7 once images are uploaded, [ProductSeoSection.tsx](../../../app/admin/products/_components/ProductSeoSection.tsx) for items 8–15, and the search-keywords field for item 16. Don't write anywhere, since the product doesn't exist yet.

## Notes
- `lib/product-seo.ts`'s `getStructuredProductData` is the intended single source of product facts for SEO tooling — reuse its field mapping rather than re-deriving facts ad hoc. It doesn't cover images/`searchKeywords`; read those directly off the product record.
- `lib/seo-length.ts` ranges (`SEO_TITLE_RANGE`, `META_DESCRIPTION_RANGE`) are advisory in the admin UI but the whole point of this skill is to land inside them.
- `POST /api/products` and `PUT /api/products/[id]` validate `colorVariants[*].imageDetails` (added alongside this skill update — previously the zod schemas silently stripped it, so alt text typed in the admin UI never persisted). If that validation is ever missing again, alt-text writes will silently no-op — verify with a `GET` after applying.
- The live site reads `product.seo.*` at request time via `lib/seo.ts` (see `app/[lng]/product/[baseSku]/[colorSlug]/layout.tsx`) — writing to Firestore through the API above is enough for changes to show up; no separate sync step is needed for SEO fields. `searchKeywords` and `imageDetails` also read straight from the same Firestore product document, no separate sync step either.
