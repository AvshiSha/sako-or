import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { parsePaymentData } from '@/lib/orders';
import {
  InvoiceTotalsMismatchError,
  buildDocumentLines,
  calculateInvoiceTotals,
  resolveOrderLevelDiscount,
} from '@/lib/verifone-invoice';
import GenerateInvoiceButton from './GenerateInvoiceButton';

/**
 * TEMPORARY - a one-order recovery page.
 *
 * ORDER-1794766845298 was charged and confirmed, but its Verifone invoice was
 * rejected (status 414) by the coupon-allocation bug since fixed in
 * lib/verifone-invoice-lines.ts. Verifone only answers the production static
 * IPs, so the retry has to be triggered from the deployed site - this page is
 * that trigger.
 *
 * The admin panel has no orders section, so this is a fixed path rather than a
 * [orderNumber] route: the page exists for this one order and no other.
 *
 * DELETE THIS FOLDER once the invoice exists, together with
 * app/api/admin/orders/verifone-invoice/route.ts and its vercel.json
 * maxDuration entry. The calculation fixes and validation gates stay.
 *
 * Auth: app/(unlocalized)/admin/layout.tsx verifies the admin session cookie
 * server-side before this renders, and the POST route re-checks on its own.
 */

const ORDER_NUMBER = 'ORDER-1794766845298';

export const dynamic = 'force-dynamic';

function money(value: number | null | undefined): string {
  if (value == null) return '—';
  return `₪${value.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function TemporaryInvoiceRecoveryPage() {
  const order = await prisma.order.findUnique({
    where: { orderNumber: ORDER_NUMBER },
    include: {
      orderItems: true,
      appliedCoupons: true,
      user: { select: { verifoneCustomerNo: true, phone: true } },
    },
  });

  if (!order) notFound();

  const paymentData = parsePaymentData(order.paymentData);
  const pointsUsed = paymentData?.pointsToSpend || 0;
  const orderLevelDiscount = resolveOrderLevelDiscount(order);
  const chargedAmount = (paymentData?.transactionInfo as { Amount?: number } | undefined)?.Amount;

  // Preview the document with the corrected logic - the same functions the POST
  // route uses - so the numbers can be checked before anything is sent.
  let preview:
    | {
        ok: true;
        lines: ReturnType<typeof buildDocumentLines>;
        sumLines: number;
        headerTotal: number;
        totalPriceIncludeVAT: number;
      }
    | { ok: false; message: string } ;
  try {
    const lines = buildDocumentLines({
      orderItems: order.orderItems,
      orderLevelDiscount,
      pointsUsed,
      deliveryFee: order.deliveryFee || 0,
      orderTotal: order.total,
      orderNumber: order.orderNumber,
    });
    const totals = calculateInvoiceTotals(lines, order.total);
    preview = {
      ok: true,
      lines,
      sumLines: Math.round(lines.reduce((sum, line) => sum + line.TotalPrice, 0) * 100) / 100,
      headerTotal:
        Math.round((totals.TotalAfterDiscount_WithoutVAT + totals.VAT) * 100) / 100,
      totalPriceIncludeVAT: totals.TotalPriceIncludeVAT,
    };
  } catch (error) {
    preview = {
      ok: false,
      message:
        error instanceof InvoiceTotalsMismatchError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error),
    };
  }

  const alreadyInvoiced =
    Boolean(order.verifoneInvoiceNo) || order.verifoneInvoiceStatus === 'success';

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="mb-2 inline-block rounded bg-amber-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
        Temporary recovery page
      </p>
      <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
      <p className="mt-1 text-gray-600" dir="auto">
        {order.customerName} · {order.customerEmail}
      </p>

      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Order</h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <Field label="Status" value={order.status} />
          <Field label="Payment" value={order.paymentStatus} />
          <Field label="Charged (CardCom)" value={money(chargedAmount)} />
          <Field label="Subtotal" value={money(order.subtotal)} />
          <Field label="Coupon / BOGO" value={money(orderLevelDiscount)} />
          <Field label="Points used" value={money(pointsUsed)} />
          <Field label="Delivery" value={money(order.deliveryFee)} />
          <Field label="Order total" value={money(order.total)} />
          <Field label="Items" value={String(order.orderItems.length)} />
        </dl>
      </section>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Verifone invoice</h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <Field label="Status" value={order.verifoneInvoiceStatus ?? '—'} />
          <Field label="Invoice no." value={order.verifoneInvoiceNo ?? '—'} />
          <Field
            label="Last attempt"
            value={order.verifoneInvoiceAttemptedAt?.toISOString() ?? '—'}
          />
        </dl>
        {order.verifoneInvoiceError && (
          <p className="mt-4 rounded-lg bg-gray-50 p-3 font-mono text-xs break-words text-gray-700">
            {order.verifoneInvoiceError}
          </p>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Document preview (what will be sent)
        </h2>
        {preview.ok ? (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pe-4">#</th>
                    <th className="py-2 pe-4">ItemID</th>
                    <th className="py-2 pe-4 text-right">Unit</th>
                    <th className="py-2 pe-4 text-right">Qty</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {preview.lines.map(line => (
                    <tr key={line.LineNo} className="border-b border-gray-100">
                      <td className="py-2 pe-4">{line.LineNo}</td>
                      <td className="py-2 pe-4">{line.ItemID}</td>
                      <td className="py-2 pe-4 text-right">{line.UnitPrice.toFixed(2)}</td>
                      <td className="py-2 pe-4 text-right">{line.Qty}</td>
                      <td className="py-2 text-right">{line.TotalPrice.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-gray-700">
              Lines {preview.sumLines.toFixed(2)} · header {preview.headerTotal.toFixed(2)} ·
              charged {preview.totalPriceIncludeVAT.toFixed(2)}{' '}
              {preview.sumLines === preview.totalPriceIncludeVAT &&
              preview.headerTotal === preview.totalPriceIncludeVAT ? (
                <span className="font-semibold text-green-700">— reconciles</span>
              ) : (
                <span className="font-semibold text-red-700">— does NOT reconcile</span>
              )}
            </p>
          </>
        ) : (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {preview.message}
          </p>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <GenerateInvoiceButton
          orderNumber={order.orderNumber}
          alreadyInvoiced={alreadyInvoiced}
        />
        <p className="mt-4 text-xs text-gray-500" dir="auto">
          הכפתור שולח בקשת CreateInvoice אחת ל-Verifone מהשרת, עבור הזמנה זו בלבד. אין חיוב נוסף, לא
          נשלח מייל או SMS, והבקשה נחסמת אם כבר קיימת חשבונית.
        </p>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-gray-900" dir="auto">
        {value}
      </dd>
    </div>
  );
}
