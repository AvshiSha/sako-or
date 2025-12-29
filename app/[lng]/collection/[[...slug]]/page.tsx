import { getCollectionProducts, categoryService } from "@/lib/firebase";
import CollectionClient from "./CollectionClient";
import { headers } from 'next/headers';

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

  // If search query exists, fetch from search API
  if (searchQuery) {
    try {
      const page = typeof resolvedSearchParams.page === 'string' 
        ? parseInt(resolvedSearchParams.page) 
        : 1;
      
      // Use absolute URL for server-side fetch
      // Try to get the host from request headers first (most reliable)
      let baseUrl: string;
      try {
        const headersList = await headers();
        const host = headersList.get('host');
        const protocol = headersList.get('x-forwarded-proto') || 
                        (process.env.NODE_ENV === 'production' ? 'https' : 'http');
        
        if (host) {
          baseUrl = `${protocol}://${host}`;
        } else {
          throw new Error('No host header');
        }
      } catch (headerError) {
        // Fallback to environment variables if headers not available
        if (process.env.VERCEL_URL) {
          // Vercel provides VERCEL_URL without protocol (e.g., "sako-or-git-v2searchbar-sako-or.vercel.app")
          baseUrl = `https://${process.env.VERCEL_URL}`;
        } else if (process.env.NEXT_PUBLIC_BASE_URL) {
          // Use NEXT_PUBLIC_BASE_URL if available (should include protocol)
          baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        } else {
          // Fallback for localhost
          const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
          baseUrl = `${protocol}://localhost:3000`;
        }
      }
      
      const searchUrl = `${baseUrl}/api/products/search?q=${encodeURIComponent(searchQuery)}&page=${page}&limit=24`;
      
      const searchResponse = await fetch(searchUrl, { 
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        products = searchData.items || [];
        searchTotal = searchData.total || 0;
        searchPage = searchData.page || 1;
      } else {
        const errorText = await searchResponse.text();
        console.error('Search API error:', searchResponse.status, searchResponse.statusText, errorText);
      }
    } catch (error) {
      console.error('Error fetching search results:', error);
    }
  } else {
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
      categoryPath={searchQuery ? undefined : (slug ? slug.map(s => decodeURIComponent(s)).join('/') : undefined)}
      selectedCategory={searchQuery ? "All Products" : (slug && slug.length > 0 ? decodeURIComponent(slug[0]) : "All Products")}
      selectedSubcategory={searchQuery ? null : (slug && slug.length >= 2 ? decodeURIComponent(slug[slug.length - 1]) : null)}
      lng={lng}
      searchQuery={searchQuery}
      searchTotal={searchTotal}
      searchPage={searchPage}
    />
  );
}
