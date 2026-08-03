import { notFound } from "next/navigation";
import { getCachedProductByBaseSku } from "@/lib/server/cached-product-data";
import { pickProductClientView } from "@/lib/product-types";
import { serializeFirestoreValue } from "@/lib/serialize-firestore";
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

  return (
    <ProductColorClient
      lng={lng}
      baseSku={baseSku}
      colorSlug={colorSlug}
      initialProduct={serializeFirestoreValue({
        ...pickProductClientView(product),
        colorVariants: product.colorVariants,
      })}
      initialVariant={serializeFirestoreValue(variant)}
    />
  );
}
