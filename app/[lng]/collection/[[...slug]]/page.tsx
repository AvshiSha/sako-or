import { getCollectionProducts, categoryService } from "@/lib/firebase";
import CollectionClient from "./CollectionClient";
import { searchProducts } from "@/lib/search-products";

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

  // Check for search query parameter
  const searchQuery = typeof resolvedSearchParams.search === 'string' 
    ? resolvedSearchParams.search.trim() 
    : undefined;

  let products: any[] = [];
  let searchTotal = 0;
  let searchPage = 1;
  let categoryPath: string | undefined;
  let selectedCategory = "All Products";
  let selectedSubcategory: string | null = null;

  // If search query exists, call search function directly (avoids HTTP request and Vercel protection issues)
  if (searchQuery) {
    try {
      const page = typeof resolvedSearchParams.page === 'string' 
        ? parseInt(resolvedSearchParams.page) 
        : 1;
      
      // Call search function directly instead of making HTTP request
      // This avoids Vercel Deployment Protection issues
      const searchData = await searchProducts(searchQuery, page, 24);
      products = searchData.items || [];
      searchTotal = searchData.total || 0;
      searchPage = searchData.page || 1;
    } catch (error) {
      console.error('Error searching products:', error);
    }
  } else {
    // Build category path from slug
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
    const collectionData = await getCollectionProducts(categoryPath, resolvedSearchParams, lng as 'en' | 'he');
    products = collectionData.products;
  }

  // Fetch categories for the client component (needed for breadcrumbs and other UI)
  const categories = await categoryService.getAllCategories();

  // Serialize Firestore timestamps before passing to client component
  const serializedProducts = products.map((product) => serializeValue(product));
  const serializedCategories = categories.map((category) => serializeValue(category));

  return (
    <CollectionClient
      initialProducts={serializedProducts}
      categories={serializedCategories}
      categoryPath={searchQuery ? undefined : categoryPath}
      selectedCategory={searchQuery ? "All Products" : selectedCategory}
      selectedSubcategory={searchQuery ? null : selectedSubcategory}
      lng={lng}
      searchQuery={searchQuery}
      searchTotal={searchTotal}
      searchPage={searchPage}
    />
  );
}
