import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/prisma';
import { parsePaymentData } from '@/lib/orders';
import {
  buildInvoiceEnvelopeForOrder,
  createVerifoneInvoiceAsync,
} from '@/lib/verifone-invoice-job';
import {
  InvoiceTotalsMismatchError,
  buildDocumentLines,
  calculateInvoiceTotals,
  resolveOrderLevelDiscount,
} from '@/lib/verifone-invoice';

/**
 * Verifone invoice recovery, from the domain.
 *
 * Verifone's SOAP endpoint only accepts the production static IPs, so a failed
 * invoice cannot be re-sent from a laptop - it has to be retried from a deployed
 * request. This endpoint is that path, and it is also where a failed invoice
 * becomes visible: an order can be fully paid, confirmed and emailed while its
 * Verifone invoice is missing, and nothing else surfaces that.
 *
 *   GET                       list orders that are paid but not invoiced
 *   GET  ?order=ORDER-123     dry run: reconcile and build, send nothing
 *   POST ?order=ORDER-123     create the invoice (refuses if already invoiced)
 *
 * Authenticated with the same credential and headers as the other cron routes
 * (`x-cron-secret`, `x-vercel-cron-secret`, or `Authorization: Bearer`) - never
 * as a query parameter, which would end up in access logs. It never touches the
 * payment and never sends a confirmation email or SMS.
 */

const LOG = '[VERIFONE_INVOICE_RETRY]';

function authorize(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error(`${LOG} CRON_SECRET environment variable is not set`);
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const provided =
    request.headers.get('x-vercel-cron-secret') ||
    request.headers.get('x-cron-secret') ||
    authHeader?.replace(/^Bearer /i, '');

  if (!provided || provided !== cronSecret) {
    console.warn(`${LOG} Unauthorized access attempt`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

async function loadOrder(orderNumber: string) {
  return prisma.order.findUnique({
    where: { orderNumber },
    include: {
      orderItems: true,
      appliedCoupons: true,
      user: { select: { verifoneCustomerNo: true, phone: true } },
    },
  });
}

type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

function invoiceInputs(order: LoadedOrder) {
  const paymentData = parsePaymentData(order.paymentData);
  const transactionInfo = paymentData?.transactionInfo ?? {};
  return {
    transactionInfo,
    pointsUsed: paymentData?.pointsToSpend || 0,
    orderLevelDiscount: resolveOrderLevelDiscount(order),
  };
}

/** Reconcile and build without sending. Returns what is wrong, if anything. */
function dryRun(order: LoadedOrder) {
  const { transactionInfo, pointsUsed, orderLevelDiscount } = invoiceInputs(order);

  try {
    const documentLines = buildDocumentLines({
      orderItems: order.orderItems,
      orderLevelDiscount,
      pointsUsed,
      deliveryFee: order.deliveryFee || 0,
      orderTotal: order.total,
      orderNumber: order.orderNumber,
    });
    const totals = calculateInvoiceTotals(documentLines, order.total);
    const sumLinesWithVAT =
      Math.round(documentLines.reduce((sum, line) => sum + line.TotalPrice, 0) * 100) / 100;

    // Building the envelope runs the remaining gates (charged-amount check and
    // the final lines-vs-header assertion).
    const envelope = buildInvoiceEnvelopeForOrder(order, transactionInfo, pointsUsed);

    return {
      reconciles: true as const,
      inputs: {
        orderTotal: order.total,
        subtotal: order.subtotal,
        discountTotal: order.discountTotal,
        bogoDiscountAmount: order.bogoDiscountAmount,
        orderLevelDiscount,
        deliveryFee: order.deliveryFee || 0,
        pointsUsed,
        verifiedPaymentAmount: (transactionInfo as { Amount?: number }).Amount ?? null,
      },
      totals: {
        sumLinesWithVAT,
        headerNetPlusVAT:
          Math.round((totals.TotalAfterDiscount_WithoutVAT + totals.VAT) * 100) / 100,
        TotalPriceIncludeVAT: totals.TotalPriceIncludeVAT,
        TotalItems: totals.TotalItems,
        TotalLines: totals.TotalLines,
      },
      lines: documentLines,
      envelopeBytes: envelope.length,
    };
  } catch (error) {
    if (error instanceof InvoiceTotalsMismatchError) {
      return {
        reconciles: false as const,
        code: error.code,
        error: error.message,
        diagnostics: error.diagnostics,
      };
    }
    throw error;
  }
}

/** GET: list recoverable orders, or dry-run a single one. */
export async function GET(request: NextRequest) {
  const unauthorized = authorize(request);
  if (unauthorized) return unauthorized;

  try {
    const orderNumber = new URL(request.url).searchParams.get('order');

    if (!orderNumber) {
      // Paid orders whose Verifone invoice is missing - the recovery queue.
      const pending = await prisma.order.findMany({
        where: {
          paymentStatus: 'completed',
          verifoneInvoiceNo: null,
          OR: [
            { verifoneInvoiceStatus: 'failed' },
            { verifoneInvoiceStatus: 'pending' },
            { verifoneInvoiceStatus: null },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          orderNumber: true,
          createdAt: true,
          total: true,
          status: true,
          paymentStatus: true,
          verifoneInvoiceStatus: true,
          verifoneInvoiceAttemptedAt: true,
          verifoneInvoiceError: true,
        },
      });

      return NextResponse.json({
        success: true,
        count: pending.length,
        orders: pending,
      });
    }

    const order = await loadOrder(orderNumber);
    if (!order) {
      return NextResponse.json({ error: `Order not found: ${orderNumber}` }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      orderNumber: order.orderNumber,
      invoiceStatus: {
        status: order.verifoneInvoiceStatus,
        invoiceNo: order.verifoneInvoiceNo,
        attemptedAt: order.verifoneInvoiceAttemptedAt,
        syncedAt: order.verifoneInvoiceSyncedAt,
        error: order.verifoneInvoiceError,
      },
      alreadyInvoiced: Boolean(order.verifoneInvoiceNo) || order.verifoneInvoiceStatus === 'success',
      dryRun: dryRun(order),
    });
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'verifone-invoice-retry' } });
    console.error(`${LOG} GET failed`, error);
    return NextResponse.json(
      { error: 'Failed to inspect invoice', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/** POST: actually create the invoice for one order. */
export async function POST(request: NextRequest) {
  const unauthorized = authorize(request);
  if (unauthorized) return unauthorized;

  try {
    const orderNumber = new URL(request.url).searchParams.get('order');
    if (!orderNumber) {
      return NextResponse.json({ error: 'Missing ?order=ORDER-...' }, { status: 400 });
    }

    const order = await loadOrder(orderNumber);
    if (!order) {
      return NextResponse.json({ error: `Order not found: ${orderNumber}` }, { status: 404 });
    }

    // Duplicate guard. `createVerifoneInvoiceAsync` enforces this too; answering
    // here keeps the response honest about why nothing happened.
    if (order.verifoneInvoiceNo || order.verifoneInvoiceStatus === 'success') {
      return NextResponse.json(
        {
          success: false,
          skipped: 'already-invoiced',
          invoiceNo: order.verifoneInvoiceNo,
        },
        { status: 409 }
      );
    }

    if (order.paymentStatus !== 'completed') {
      return NextResponse.json(
        {
          success: false,
          skipped: 'payment-not-completed',
          paymentStatus: order.paymentStatus,
        },
        { status: 409 }
      );
    }

    const { transactionInfo } = invoiceInputs(order);

    console.log(`${LOG} Retrying invoice for ${orderNumber}`);
    await createVerifoneInvoiceAsync(orderNumber, { transactionInfo }, { force: true });

    const after = await prisma.order.findUnique({
      where: { orderNumber },
      select: {
        verifoneInvoiceStatus: true,
        verifoneInvoiceNo: true,
        verifoneInvoiceError: true,
        verifoneInvoiceSyncedAt: true,
        verifoneInvoiceResponse: true,
      },
    });

    const succeeded = after?.verifoneInvoiceStatus === 'success';
    return NextResponse.json(
      {
        success: succeeded,
        orderNumber,
        invoiceStatus: after,
      },
      { status: succeeded ? 200 : 502 }
    );
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'verifone-invoice-retry' } });
    console.error(`${LOG} POST failed`, error);
    return NextResponse.json(
      { error: 'Failed to retry invoice', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
