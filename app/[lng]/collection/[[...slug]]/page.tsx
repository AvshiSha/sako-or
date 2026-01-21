import { getCollectionProducts, categoryService } from "@/lib/firebase";
import CollectionClient from "./CollectionClient";
import { searchProducts } from "@/lib/search-products";
import { buildMetadata, buildAbsoluteUrl } from "@/lib/seo";
import type { Metadata } from 'next';
import { languages } from '@/i18n/settings';

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

// Generate metadata for collection pages
export async function generateMetadata({
  params,
  searchParams,
}: CollectionPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const { lng, slug } = resolvedParams;
  const locale = lng as 'en' | 'he';

  // Check for search query - if searching, use default collection metadata
  const searchQuery = typeof resolvedSearchParams.search === 'string'
    ? resolvedSearchParams.search.trim()
    : undefined;

  if (searchQuery) {
    // For search results, use generic collection metadata
    const title = locale === 'he' ? 'חיפוש מוצרים | SAKO-OR' : 'Search Products | SAKO-OR';
    const description = locale === 'he'
      ? 'חפשו מוצרים באיכות גבוהה מבית סכו עור'
      : 'Search for high-quality products from SAKO-OR';
    const url = `/${lng}/collection${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`;

    return buildMetadata({
      title,
      description,
      url,
      locale,
      alternateLocales: languages
        .filter(l => l !== locale)
        .map(altLng => ({
          locale: altLng,
          url: `/${altLng}/collection${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`,
        })),
    });
  }

  // Build category path from slug
  let categoryPath: string | undefined;
  if (slug && slug.length > 0) {
    categoryPath = slug.map(s => decodeURIComponent(s)).join('/');
  }

  // Get category information
  let categoryName = locale === 'he' ? 'כל המוצרים' : 'All Products';
  let categoryDescription = locale === 'he'
    ? 'גלה את כל המוצרים שלנו - נעליים, תיקים ואביזרי אופנה באיכות גבוהה'
    : 'Discover all our products - shoes, bags, and fashion accessories of the highest quality';
  let categoryImage: string | undefined;

  if (categoryPath) {
    try {
      // Get category IDs from path
      const categoryIdsResult = await categoryService.getCategoryIdsFromPath(categoryPath, locale);

      if (categoryIdsResult && categoryIdsResult.categoryIds.length > 0) {
        // Get the deepest category (target level)
        const targetCategoryId = categoryIdsResult.categoryIds[categoryIdsResult.categoryIds.length - 1];
        const category = await categoryService.getCategoryById(targetCategoryId);

        if (category) {
          categoryName = category.name[locale] || category.name.en || categoryName;

          // If we are on a level-2 category page, prepend the parent (level-1) category name.
          // Example: women/shoes/boots -> "Shoes Boots" (localized)
          if (categoryIdsResult.targetLevel === 2 && categoryIdsResult.categoryIds.length >= 2) {
            const parentCategoryId = categoryIdsResult.categoryIds[1];
            const parentCategory = await categoryService.getCategoryById(parentCategoryId);
            if (parentCategory) {
              const parentName = parentCategory.name[locale] || parentCategory.name.en;
              if (parentName) {
                categoryName = `${parentName} ${categoryName}`.trim();
              }
            }
          }

          categoryDescription = category.description?.[locale] ||
            category.description?.en ||
            categoryDescription;
          categoryImage = category.image;
        }
      }
    } catch (error) {
      console.error('Error fetching category for metadata:', error);
      // Fall back to default values
    }
  }

  // Build URL
  const url = `/${lng}/collection${categoryPath ? `/${categoryPath}` : ''}`;

  // Generate title and description
  const title = `${categoryName} | SAKO-OR`;
  const description = categoryDescription;

  // Build alternate locales
  const alternateLocales = languages
    .filter(l => l !== locale)
    .map(altLng => ({
      locale: altLng,
      url: `/${altLng}/collection${categoryPath ? `/${categoryPath}` : ''}`,
    }));

  return buildMetadata({
    title,
    description,
    url,
    image: categoryImage,
    type: 'website',
    locale,
    alternateLocales,
  });
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
      // Parse and validate page parameter
      let page = 1;
      if (typeof resolvedSearchParams.page === 'string') {
        const parsedPage = parseInt(resolvedSearchParams.page, 10);
        // Validate that parsing resulted in a valid positive integer
        if (!isNaN(parsedPage) && parsedPage > 0 && Number.isInteger(parsedPage)) {
          page = parsedPage;
        }
      }

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
