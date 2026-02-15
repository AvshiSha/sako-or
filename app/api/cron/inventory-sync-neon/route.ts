import { NextRequest, NextResponse } from 'next/server';
import { syncInventoryFromFirebaseToNeon } from '@/lib/inventory';

/**
 * GET /api/cron/inventory-sync-neon
 *
 * CRON job to sync inventory (colorVariants) from Firebase to Neon.
 * Runs after inventory-sync; no Verifone calls.
 * Protected by CRON_SECRET header (set by Vercel)
 *
 * Schedule: 15 min past the hour, every 3 hours (15 *\/3 * * *)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error(
        '[CRON_INVENTORY_SYNC_NEON] CRON_SECRET environment variable is not set'
      );
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization');
    const vercelCronSecret = request.headers.get('x-vercel-cron-secret');
    const cronSecretHeader = request.headers.get('x-cron-secret');

    const providedSecret =
      vercelCronSecret ||
      cronSecretHeader ||
      authHeader?.replace(/^Bearer /i, '');

    if (!providedSecret || providedSecret !== cronSecret) {
      console.warn(
        '[CRON_INVENTORY_SYNC_NEON] Unauthorized access attempt - invalid or missing CRON_SECRET'
      );
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON_INVENTORY_SYNC_NEON] Starting Firebase->Neon inventory sync...');

    const result = await syncInventoryFromFirebaseToNeon();

    const duration = Date.now() - startTime;

    const response = {
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

    console.log('[CRON_INVENTORY_SYNC_NEON] Sync completed', {
      success: response.success,
      summary: response.summary,
      duration: response.duration,
    });

    return NextResponse.json(response, {
      status: result.failed === 0 ? 200 : 207,
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    let errorMessage = 'Unknown error';
    let errorStack: string | undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      errorMessage = (error as any).message || String(error);
    }

    console.error('[CRON_INVENTORY_SYNC_NEON] Fatal error', {
      error: errorMessage,
      errorStack,
      duration: `${duration}ms`,
    });

    const errorResponse: Record<string, unknown> = {
      success: false,
      error: 'Failed to sync inventory from Firebase to Neon',
      details: errorMessage,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };

    if (process.env.NODE_ENV === 'development' && errorStack) {
      errorResponse.stack = errorStack;
    }

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
