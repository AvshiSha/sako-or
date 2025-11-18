import { getCollectionProducts, categoryService } from "@/lib/firebase";
import CollectionClient from "./CollectionClient";

// Helper to serialize Firestore timestamps or other complex objects
const serializeValue = (value: any): any => {
  if (value === null || value === undefined) return value;

  // Firestore Timestamp-like object
  if (
    typeof value === "object" &&
    "seconds" in value &&
    "nanoseconds" in value
  ) {
    const milliseconds =
      (value.seconds as number) * 1000 + (value.nanoseconds as number) / 1_000_000;
    return new Date(milliseconds).toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (typeof value === "object") {
    const serialized: Record<string, any> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      serialized[key] = serializeValue(nestedValue);
    }
    return serialized;
  }

  return value;
};

interface CollectionPageProps {
  params: Promise<{
    lng: string;
    slug?: string[];
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CollectionSlugPage({
  params,
  searchParams,
}: CollectionPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const { lng, slug } = resolvedParams;

  // Build category path from slug
  let categoryPath: string | undefined;
  let selectedCategory = "All Products";
  let selectedSubcategory: string | null = null;
    
    if (slug && slug.length > 0) {
      categoryPath = slug.map(s => decodeURIComponent(s)).join('/');
      
      if (slug.length === 1) {
        // URL: /en/collection/women
      selectedCategory = decodeURIComponent(slug[0]);
      } else if (slug.length === 2) {
        // URL: /en/collection/women/shoes
      selectedCategory = decodeURIComponent(slug[0]);
      selectedSubcategory = decodeURIComponent(slug[1]);
      } else if (slug.length === 3) {
        // URL: /en/collection/women/shoes/boots
      selectedCategory = decodeURIComponent(slug[0]);
      selectedSubcategory = decodeURIComponent(slug[2]); // The deepest category
      } else {
        // For deeper paths, use the full path
      selectedCategory = categoryPath;
    }
  }

  // Fetch filtered products server-side
  const { products } = await getCollectionProducts(categoryPath, resolvedSearchParams, lng as 'en' | 'he');

  // Fetch categories for the client component (needed for breadcrumbs and other UI)
  const categories = await categoryService.getAllCategories();

  // Serialize Firestore timestamps before passing to client component
  const serializedProducts = products.map((product) => serializeValue(product));
  const serializedCategories = categories.map((category) => serializeValue(category));

  return (
    <CollectionClient
      initialProducts={serializedProducts}
      categories={serializedCategories}
      categoryPath={categoryPath}
      selectedCategory={selectedCategory}
      selectedSubcategory={selectedSubcategory}
      lng={lng}
    />
  );
}
