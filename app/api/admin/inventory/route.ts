import { NextRequest, NextResponse } from 'next/server';
import { parseCsvContent, updateInventoryFromCsv, parseInventorySku, InventoryUpdateRow } from '@/lib/inventory';

/**
 * POST /api/admin/inventory
 * 
 * Upload CSV and update inventory in both Firebase and Neon
 * 
 * Request body:
 * - csvContent: string (CSV file content)
 * - preview: boolean (optional, if true only parse without updating)
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

    // Parse CSV
    let rows: InventoryUpdateRow[];
    try {
      rows = parseCsvContent(csvContent);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Failed to parse CSV',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found in CSV' },
        { status: 400 }
      );
    }

    // If preview mode, just parse and return
    if (preview) {
      const parsedRows = rows.map((row) => ({
        ...row,
        parsed: parseInventorySku(row.sku),
      }));

      const validCount = parsedRows.filter((r) => r.parsed.isValid).length;
      const invalidCount = parsedRows.length - validCount;

      return NextResponse.json({
        preview: true,
        total: parsedRows.length,
        valid: validCount,
        invalid: invalidCount,
        rows: parsedRows,
      });
    }

    // Execute the update
    const result = await updateInventoryFromCsv(rows);

    return NextResponse.json({
      success: result.failed === 0,
      total: result.total,
      successCount: result.success,
      failed: result.failed,
      skipped: result.skipped,
      errors: result.errors,
      details: result.details,
    });
  } catch (error) {
    console.error('Inventory update error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update inventory',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/inventory
 * 
 * Get inventory statistics (optional, for future use)
 */
export async function GET() {
  return NextResponse.json({
    message: 'Inventory API is running',
    endpoints: {
      POST: 'Upload CSV to update inventory',
    },
  });
}

