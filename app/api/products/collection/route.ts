import { NextRequest, NextResponse } from 'next/server';
import { getCollectionProducts } from '@/lib/firebase';
import { searchProducts } from '@/lib/search-products';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const categoryPath = searchParams.get('categoryPath') || undefined;
    const searchQuery = searchParams.get('search') || undefined;
    const pageParam = searchParams.get('page');
    const language = (searchParams.get('language') || 'en') as 'en' | 'he';
    
    // Parse page
    let page = 1;
    if (pageParam) {
      const parsedPage = parseInt(pageParam, 10);
      if (!isNaN(parsedPage) && parsedPage > 0 && Number.isInteger(parsedPage)) {
        page = parsedPage;
      }
    }
    
    // Build searchParams object from URL params
    const urlSearchParams: { [key: string]: string | string[] | undefined } = {};
    searchParams.forEach((value, key) => {
      if (key !== 'categoryPath' && key !== 'search' && key !== 'page' && key !== 'language') {
        urlSearchParams[key] = value;
      }
    });
    urlSearchParams.page = page.toString();
    
    let result;
    
    if (searchQuery) {
      // Use search function
      const searchData = await searchProducts(searchQuery, page, 24);
      result = {
        items: searchData.items || [],
        total: searchData.total || 0,
        page: searchData.page || 1,
        pageSize: searchData.limit || 24,
        hasMore: (searchData.page * (searchData.limit || 24)) < (searchData.total || 0),
      };
    } else {
      // Use collection products function
      const collectionData = await getCollectionProducts(categoryPath, urlSearchParams, language);
      result = {
        items: collectionData.products || [], // Backward compatibility
        variantItems: collectionData.variantItems || [], // New: variant items for collection pages
        total: collectionData.total || 0,
        page: collectionData.page || 1,
        pageSize: collectionData.pageSize || 24,
        hasMore: collectionData.hasMore || false,
        availableFilterOptions: collectionData.availableFilterOptions,
      };
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching collection products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products', items: [], total: 0, page: 1, pageSize: 24, hasMore: false },
      { status: 500 }
    );
  }
}
