import { notFound } from "next/navigation";
import { getCachedProductByBaseSku } from "@/lib/server/cached-product-data";
import { pickProductClientView } from "@/lib/product-types";
import { serializeFirestoreValue } from "@/lib/serialize-firestore";
import {
  resolveCategoryTrail,
  deepestCategoryName,
} from "@/lib/server/product-category-trail";
import { buildProductTitle } from "@/lib/product-seo";
import { getColorName } from "@/lib/colors";
import ProductColorClient from "./ProductColorClient";

interface ProductColorPageProps {
  params: Promise<{
    lng: string;
    baseSku: string;
    colorSlug: string;
  }>;
}

export default async function ProductColorPage({
  params,
}: ProductColorPageProps) {
  const { lng, baseSku, colorSlug } = await params;

  if (!["en", "he"].includes(lng)) {
    notFound();
  }

  const product = await getCachedProductByBaseSku(baseSku);
  if (!product) {
    notFound();
  }

  const variant = Object.values(product.colorVariants || {}).find(
    (v) => v.colorSlug === colorSlug
  );

  if (!variant || variant.isActive === false) {
    notFound();
  }

  const locale = lng as "en" | "he";

  // The stored title_he/title_en is the brand ("SAKO BAGS"), so every bag would
  // otherwise render an identical <h1>. Compose the same name the page title
  // and JSON-LD already use — category + colour, brand trailing — so each
  // product is distinguishable to a reader and to a crawler.
  const categoryTrail = await resolveCategoryTrail(product, locale);
  const seoName = buildProductTitle({
    seoTitleOverride: locale === "he" ? product.seo?.title_he : product.seo?.title_en,
    productTitle: locale === "he" ? product.title_he : product.title_en,
    categoryName: deepestCategoryName(categoryTrail),
    colorName: getColorName(colorSlug, locale),
  });

  // Two names, deliberately. `seoName` is keyword-led and long enough to be
  // awkward as a heading; the merchandiser-authored short title reads better
  // above the fold. The heading swap costs nothing in search as long as
  // `seoName` stays in the <title> (generateMetadata composes it separately in
  // layout.tsx) and stays visible on the page — ProductColorClient renders it
  // as a sub-line under the heading. Products with no short title keep the
  // previous behaviour exactly, and the sub-line suppresses itself.
  const shortTitle = (
    locale === "he" ? product.shortTitle_he : product.shortTitle_en
  )?.trim();

  return (
    <ProductColorClient
      lng={lng}
      baseSku={baseSku}
      colorSlug={colorSlug}
      displayName={shortTitle || seoName}
      seoName={seoName}
      categoryTrail={categoryTrail.map((crumb) => crumb.name)}
      initialProduct={serializeFirestoreValue({
        ...pickProductClientView(product),
        colorVariants: product.colorVariants,
      })}
      initialVariant={serializeFirestoreValue(variant)}
    />
  );
}
