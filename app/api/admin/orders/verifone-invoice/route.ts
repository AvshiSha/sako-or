import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { requireAdminSession } from '@/lib/server/auth';
import { prisma } from '@/lib/prisma';
import { parsePaymentData } from '@/lib/orders';
import { createVerifoneInvoiceAsync } from '@/lib/verifone-invoice-job';

/**
 * TEMPORARY - one-off recovery endpoint for ORDER-1794766845298.
 *
 * Verifone's SOAP endpoint only accepts the production static IPs, so the
 * invoice that failed on this order (status 414, before the allocation fix)
 * cannot be re-sent from a laptop. This runs the corrected build + the existing
 * retry flow from a deployed request, triggered by an admin clicking the button
 * on /admin/orders/ORDER-1794766845298.
 *
 * DELETE THIS FILE once the invoice exists, together with
 * app/(unlocalized)/admin/orders/ORDER-1794766845298/ and the vercel.json
 * maxDuration entry for this route. The invoice calculation fixes and the
 * validation gates in lib/verifone-invoice*.ts are permanent and stay.
 *
 * It never charges the customer, never sends an email or SMS, and touches no
 * other order: the order number is pinned below, and the underlying job refuses
 * any order that already carries an invoice number.
 */

// The only order this endpoint will ever act on.
const ALLOWED_ORDER_NUMBER = 'ORDER-1794766845298';

const LOG = '[ADMIN_VERIFONE_INVOICE]';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const orderNumber = typeof body?.orderNumber === 'string' ? body.orderNumber : null;

    if (orderNumber !== ALLOWED_ORDER_NUMBER) {
      return NextResponse.json(
        { error: 'This endpoint only handles the single order it was added for.' },
        { status: 403 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: {
        orderNumber: true,
        paymentStatus: true,
        verifoneInvoiceNo: true,
        verifoneInvoiceStatus: true,
        paymentData: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: `Order not found: ${orderNumber}` }, { status: 404 });
    }

    // Duplicate protection. createVerifoneInvoiceAsync enforces this too; saying
    // it here keeps the admin's result message honest about why nothing ran.
    if (order.verifoneInvoiceNo || order.verifoneInvoiceStatus === 'success') {
      return NextResponse.json(
        {
          success: false,
          alreadyInvoiced: true,
          invoiceNo: order.verifoneInvoiceNo,
          error: `Order already has invoice ${order.verifoneInvoiceNo ?? '(number unknown)'} - nothing was sent.`,
        },
        { status: 409 }
      );
    }

    if (order.paymentStatus !== 'completed') {
      return NextResponse.json(
        {
          success: false,
          error: `Payment status is "${order.paymentStatus}", not "completed" - refusing to invoice an unpaid order.`,
        },
        { status: 409 }
      );
    }

    const paymentData = parsePaymentData(order.paymentData);
    const transactionInfo = paymentData?.transactionInfo ?? {};

    console.log(`${LOG} Admin ${auth.email ?? auth.firebaseUid} triggered invoice for ${orderNumber}`);

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

    // Surface Verifone's own status/description when it refused the document.
    let verifoneStatus: number | undefined;
    let verifoneStatusDescription: string | undefined;
    try {
      const parsed = after?.verifoneInvoiceResponse
        ? JSON.parse(after.verifoneInvoiceResponse)
        : null;
      verifoneStatus = parsed?.status;
      verifoneStatusDescription = parsed?.statusDescription;
    } catch {
      // The stored response is only a diagnostic; a parse failure must not
      // change the outcome reported to the admin.
    }

    console.log(`${LOG} Result for ${orderNumber}`, {
      status: after?.verifoneInvoiceStatus,
      invoiceNo: after?.verifoneInvoiceNo,
      error: after?.verifoneInvoiceError,
    });

    return NextResponse.json(
      {
        success: succeeded,
        orderNumber,
        invoiceNo: after?.verifoneInvoiceNo ?? null,
        invoiceStatus: after?.verifoneInvoiceStatus ?? null,
        syncedAt: after?.verifoneInvoiceSyncedAt ?? null,
        error: succeeded ? null : after?.verifoneInvoiceError ?? 'Unknown error',
        verifoneStatus,
        verifoneStatusDescription,
      },
      { status: succeeded ? 200 : 502 }
    );
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'admin-verifone-invoice' } });
    console.error(`${LOG} Failed`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
