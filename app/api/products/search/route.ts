import { NextRequest, NextResponse } from 'next/server'
import { searchProducts } from '@/lib/search-products'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '24')
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        items: [],
        total: 0,
        page: 1,
        limit,
        query: ''
      })
    }

    // Use shared search function
    const searchData = await searchProducts(query.trim(), page, limit)
    
    return NextResponse.json(searchData)
    
  } catch (error) {
    console.error('Search error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    // Get the query from the request
    let queryParam = ''
    try {
      const { searchParams } = new URL(request.url)
      queryParam = searchParams.get('q') || ''
    } catch {
      // Fallback if URL parsing fails
    }
    
    // Log more details in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Search query:', queryParam)
      console.error('Error stack:', errorStack)
      if (error instanceof Error && 'code' in error) {
        console.error('Error code:', (error as any).code)
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to search products',
        errorDetails: errorMessage,
        errorStack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
        items: [],
        total: 0,
        page: 1,
        limit: 24,
        query: queryParam
      },
      { status: 500 }
    )
  }
}
