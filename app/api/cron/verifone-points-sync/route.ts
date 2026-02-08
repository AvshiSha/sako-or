import { NextRequest, NextResponse } from 'next/server';
import { syncAllUserPointsFromVerifone } from '@/lib/points';

/**
 * GET /api/cron/verifone-points-sync
 *
 * CRON job endpoint to sync user loyalty points from Verifone SOAP API
 * into Neon pointsBalance.
 * Protected by CRON_SECRET header (set by Vercel)
 *
 * Schedule: Every 2 hours (0 *\/2 * * *)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error(
        '[CRON_POINTS_SYNC] CRON_SECRET environment variable is not set'
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
      vercelCronSecret || cronSecretHeader || authHeader?.replace(/^Bearer /i, '');

    if (!providedSecret || providedSecret !== cronSecret) {
      console.warn(
        '[CRON_POINTS_SYNC] Unauthorized access attempt - invalid or missing CRON_SECRET'
      );
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const maxBatchesParam = searchParams.get('maxBatches');
    const batchSizeParam = searchParams.get('batchSize');
    const concurrencyParam = searchParams.get('concurrency');

    const maxBatches = maxBatchesParam
      ? Math.max(parseInt(maxBatchesParam, 10) || 0, 0)
      : undefined;
    const batchSize = batchSizeParam
      ? Math.max(parseInt(batchSizeParam, 10) || 0, 0)
      : undefined;
    const concurrency = concurrencyParam
      ? Math.max(parseInt(concurrencyParam, 10) || 0, 0)
      : undefined;

    console.log('[CRON_POINTS_SYNC] Starting Verifone points sync...', {
      maxBatches,
      batchSize,
      concurrency
    });

    const result = await syncAllUserPointsFromVerifone({
      batchSize,
      maxBatchesPerRun: maxBatches,
      concurrency
    });

    const duration = Date.now() - startTime;

    const response = {
      success: result.failed === 0,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      summary: {
        totalProcessed: result.totalProcessed,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed
      },
      errors: result.errors.length > 0 ? result.errors : undefined
    };

    console.log('[CRON_POINTS_SYNC] Verifone points sync completed', response);

    return NextResponse.json(response, {
      status: result.failed === 0 ? 200 : 207
    });
  } catch (error) {
    const duration = Date.now() - startTime;

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
      errorMessage = (error as any).message || String(error);
    }

    console.error('[CRON_POINTS_SYNC] Fatal error during points sync', {
      error: errorMessage,
      errorName,
      errorStack,
      duration: `${duration}ms`,
      rawError: error
    });

    const errorResponse: any = {
      success: false,
      error: 'Failed to sync Verifone points',
      details: errorMessage,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    };

    if (process.env.NODE_ENV === 'development' && errorStack) {
      errorResponse.stack = errorStack;
    }

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

