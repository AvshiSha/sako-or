'use client';

/**
 * TEMPORARY - see page.tsx in this folder. Delete the whole folder once the
 * invoice for ORDER-1794766845298 exists.
 */

import { useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { getAdminAuthHeaders } from '@/lib/admin-api';

type Result = {
  success: boolean;
  invoiceNo?: string | null;
  invoiceStatus?: string | null;
  error?: string | null;
  verifoneStatus?: number;
  verifoneStatusDescription?: string;
  alreadyInvoiced?: boolean;
};

export default function GenerateInvoiceButton({
  orderNumber,
  alreadyInvoiced,
}: {
  orderNumber: string;
  alreadyInvoiced: boolean;
}) {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  // Once it has succeeded, the button stays disabled: the duplicate guard on the
  // server would refuse anyway, but there is no reason to offer the click.
  const done = alreadyInvoiced || result?.success === true;
  const disabled = running || done || !user;

  async function run() {
    if (disabled) return;
    setRunning(true);
    setResult(null);
    try {
      const response = await fetch('/api/admin/orders/verifone-invoice', {
        method: 'POST',
        headers: await getAdminAuthHeaders(user!),
        body: JSON.stringify({ orderNumber }),
      });
      const data = (await response.json().catch(() => ({}))) as Result;
      setResult(
        response.ok
          ? data
          : { ...data, success: false, error: data?.error ?? `HTTP ${response.status}` }
      );
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={run}
        disabled={disabled}
        aria-busy={running}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
      >
        {running && (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        )}
        {running ? 'מפיק חשבונית…' : 'הפקת חשבונית להזמנה זו'}
      </button>

      {!user && (
        <p className="text-sm text-gray-500" dir="auto">
          ממתין לאימות המשתמש…
        </p>
      )}

      {done && !result && (
        <p className="text-sm text-gray-600" dir="auto">
          להזמנה זו כבר קיימת חשבונית — הכפתור מושבת.
        </p>
      )}

      {result?.success && (
        <div
          className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-900"
          role="status"
          dir="auto"
        >
          <p className="font-semibold">החשבונית הופקה בהצלחה</p>
          <p className="mt-1">
            מספר חשבונית: <span className="font-mono text-lg">{result.invoiceNo ?? '—'}</span>
          </p>
        </div>
      )}

      {result && !result.success && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900"
          role="alert"
          dir="auto"
        >
          <p className="font-semibold">הפקת החשבונית נכשלה</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{result.error}</p>
          {(result.verifoneStatus != null || result.verifoneStatusDescription) && (
            <p className="mt-2 text-sm">
              Verifone status: {result.verifoneStatus ?? '—'}
              {result.verifoneStatusDescription ? ` — ${result.verifoneStatusDescription}` : ''}
            </p>
          )}
          <p className="mt-2 text-sm text-red-800">
            לא בוצע חיוב נוסף ולא נשלח מייל. ניתן לרענן את הדף ולנסות שוב.
          </p>
        </div>
      )}
    </div>
  );
}
