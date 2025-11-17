import { NextRequest, NextResponse } from 'next/server';
import { processSalePriceCsv } from '@/lib/sale-prices';

/**
 * POST /api/admin/sale-prices
 * 
 * Upload CSV and update sale prices in Firestore
 * 
 * Request body:
 * - csvContent: string (CSV file content)
 * - preview: boolean (optional, if true only validate without updating)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csvContent, preview } = body;

    if (!csvContent || typeof csvContent !== 'string') {
      return NextResponse.json(
        { error: 'CSV content is required' },
        { status: 400 }
      );
    }

    // Process CSV (dry run if preview mode)
    const result = await processSalePriceCsv(csvContent, preview === true);

    return NextResponse.json({
      success: result.errors.length === 0 && result.updated > 0,
      total: result.total,
      updated: result.updated,
      skipped: result.skipped,
      skippedByReason: result.skippedByReason,
      errors: result.errors,
      warnings: result.warnings,
      details: result.details.map((row) => ({
        rowNumber: row.rowNumber,
        sku: row.sku,
        price: row.price,
        salePrice: row.salePrice,
        validation: {
          isValid: row.validation.isValid,
          willUpdate: row.validation.willUpdate,
          reason: row.validation.reason,
          warning: row.validation.warning,
          currentPrice: row.validation.currentPrice,
          currentSalePrice: row.validation.currentSalePrice,
          csvPrice: row.validation.csvPrice,
          csvSalePrice: row.validation.csvSalePrice,
        },
      })),
    });
  } catch (error) {
    console.error('Sale price update error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process sale price update',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/sale-prices
 * 
 * Get API information
 */
export async function GET() {
  return NextResponse.json({
    message: 'Sale Price Update API is running',
    endpoints: {
      POST: 'Upload CSV to update sale prices',
    },
    csvFormat: {
      columns: ['sku', 'price', 'sale_price'],
      example: 'sku,price,sale_price\n4519-0001,799,559',
      skuFormat: 'xxxx-xxxx (8 digits with dash)',
    },
  });
}

