import { NextRequest, NextResponse } from 'next/server'
import { importService } from '@/lib/firebase'

// POST /api/import - Import products from Google Sheets
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sheetData } = body

    if (!sheetData || !Array.isArray(sheetData)) {
      return NextResponse.json(
        { error: 'Invalid sheet data. Expected an array of products.' },
        { status: 400 }
      )
    }

    // Import products from Google Sheets
    const results = await importService.importFromGoogleSheets(sheetData)

    return NextResponse.json({
      message: 'Import completed',
      results
    })
  } catch (error) {
    console.error('Error importing products:', error)
    return NextResponse.json(
      { error: 'Failed to import products' },
      { status: 500 }
    )
  }
} 