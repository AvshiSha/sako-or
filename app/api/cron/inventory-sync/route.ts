import { NextRequest, NextResponse } from 'next/server';
import { syncInventoryFromVerifone } from '@/lib/inventory';

/**
 * GET /api/cron/inventory-sync
 * 
 * CRON job endpoint to sync inventory from Verifone SOAP API
 * Protected by CRON_SECRET header (set by Vercel)
 * 
 * Schedule: Every 6 hours (0 *\/6 * * *)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify CRON_SECRET header for security
    // Vercel cron jobs send the secret in the "x-vercel-cron-secret" header
    // or in the Authorization header as "Bearer <secret>"
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error(
        '[CRON_INVENTORY_SYNC] CRON_SECRET environment variable is not set'
      );
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization');
    const vercelCronSecret = request.headers.get('x-vercel-cron-secret');
    const cronSecretHeader = request.headers.get('x-cron-secret');

    // Check various header formats
    const providedSecret =
      vercelCronSecret ||
      cronSecretHeader ||
      authHeader?.replace(/^Bearer /i, '');

    if (!providedSecret || providedSecret !== cronSecret) {
      console.warn(
        '[CRON_INVENTORY_SYNC] Unauthorized access attempt - invalid or missing CRON_SECRET'
      );
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON_INVENTORY_SYNC] Starting inventory sync from Verifone...');

    // Execute the inventory sync
    const result = await syncInventoryFromVerifone();

    const duration = Date.now() - startTime;

    const response: Record<string, unknown> = {
      success: result.failed === 0,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      summary: {
        total: result.total,
        success: result.success,
        failed: result.failed,
        skipped: result.skipped,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    };

    // Debug: include per-row details in response (especially useful for 5024-0019 etc.)
    if (result.details.length > 0) {
      const detailsSummary = result.details.map((d) => ({
        sku: d.sku,
        productSku: d.parsed?.productSku,
        colorSlug: d.parsed?.colorSlug,
        size: d.parsed?.size,
        quantity: d.quantity,
        status: d.status,
        error: d.error,
      }));
      response.debugDetails = detailsSummary;

      // Log a sample for product 5024-0019 if present
      const product5024 = detailsSummary.filter((d) => d.productSku === '5024-0019');
      if (product5024.length > 0) {
        console.log(
          '[CRON_INVENTORY_SYNC_DEBUG] Product 5024-0019 details:',
          JSON.stringify(product5024, null, 2)
        );
        response.debugProduct5024 = product5024;
      }
    }

    console.log('[CRON_INVENTORY_SYNC] Inventory sync completed', {
      ...response,
      debugDetails: '(see full response)',
    });

    return NextResponse.json(response, {
      status: result.failed === 0 ? 200 : 207, // 207 = Multi-Status (partial success)
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    // Extract error information
    let errorMessage = 'Unknown error';
    let errorStack: string | undefined;
    let errorName: string | undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
      errorName = error.name;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      // Try to extract message from error object
      errorMessage = (error as any).message || String(error);
    }

    console.error('[CRON_INVENTORY_SYNC] Fatal error during inventory sync', {
      error: errorMessage,
      errorName,
      errorStack,
      duration: `${duration}ms`,
      rawError: error,
    });

    const errorResponse: any = {
      success: false,
      error: 'Failed to sync inventory',
      details: errorMessage,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development' && errorStack) {
      errorResponse.stack = errorStack;
    }

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
