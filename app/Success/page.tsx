'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState<{
    orderId?: string;
    amount?: number;
    currency?: string;
  }>({});

  useEffect(() => {
    // Extract parameters from URL
    const lpid = searchParams?.get('lpid'); // Low Profile ID
    const orderId = searchParams?.get('orderId');
    const amount = searchParams?.get('amount');
    const currency = searchParams?.get('currency');

    if (lpid) {
      // Verify payment status with your backend
      verifyPaymentStatus(lpid, orderId);
    }

    setOrderInfo({
      orderId: orderId || undefined,
      amount: amount ? parseFloat(amount) : undefined,
      currency: currency || 'ILS',
    });

    setIsLoading(false);
  }, [searchParams]);

  const verifyPaymentStatus = async (lpid: string, orderId?: string | null) => {
    try {
      // TODO: Call your backend to verify the payment status
      // This ensures the payment was actually successful
      console.log('Verifying payment status:', { lpid, orderId });
      
      // Example implementation:
      // const response = await fetch(`/api/payments/verify/${lpid}`);
      // const result = await response.json();
      // if (!result.success) {
      //   // Redirect to failed page if verification fails
      //   window.location.href = '/Failed?lpid=' + lpid;
      // }
      
    } catch (error) {
      console.error('Failed to verify payment:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">מאמת את התשלום...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Success Icon */}
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* Success Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          התשלום בוצע בהצלחה!
        </h1>
        
        <p className="text-gray-600 mb-6">
          תודה על רכישתך. התשלום אושר ותוכל לקבל את ההזמנה שלך בקרוב.
        </p>

        {/* Order Details */}
        {orderInfo.orderId && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">פרטי ההזמנה</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>מספר הזמנה: {orderInfo.orderId}</p>
              {orderInfo.amount && (
                <p>
                  סכום: {orderInfo.amount.toFixed(2)} {orderInfo.currency}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors inline-block"
          >
            צפה בהזמנות שלי
          </Link>
          
          <Link
            href="/"
            className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors inline-block"
          >
            חזור לעמוד הבית
          </Link>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-xs text-gray-500">
          <p>תקבל אישור במייל עם פרטי ההזמנה.</p>
          <p>אם יש לך שאלות, אנא צור קשר עם התמיכה.</p>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SuccessPageContent />
    </Suspense>
  );
}
