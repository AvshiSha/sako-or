'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function CancelPageContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState<{
    orderId?: string;
  }>({});

  useEffect(() => {
    // Extract parameters from URL
    const lpid = searchParams?.get('lpid'); // Low Profile ID
    const orderId = searchParams?.get('orderId');

    setOrderInfo({
      orderId: orderId || undefined,
    });

    setIsLoading(false);
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">מעבד את המידע...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Cancel Icon */}
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-6">
          <svg
            className="h-8 w-8 text-yellow-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        {/* Cancel Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          התשלום בוטל
        </h1>
        
        <p className="text-gray-600 mb-6">
          ביטלת את התשלום. ההזמנה שלך נשמרה וניתן להשלים את התשלום מאוחר יותר.
        </p>

        {/* Order Details */}
        {orderInfo.orderId && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">פרטי ההזמנה</h3>
            <div className="text-sm text-gray-600">
              <p>מספר הזמנה: {orderInfo.orderId}</p>
              <p className="text-yellow-600 mt-1">סטטוס: ממתין לתשלום</p>
            </div>
          </div>
        )}

        {/* Information Box */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">מה קורה עכשיו?</h3>
          <ul className="text-sm text-blue-800 text-right space-y-1">
            <li>• ההזמנה שלך נשמרה במערכת</li>
            <li>• תוכל להשלים את התשלום מאוחר יותר</li>
            <li>• ההזמנה תישמר למשך 24 שעות</li>
            <li>• לא נגבה ממך כל תשלום</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/cart"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors inline-block"
          >
            השלם תשלום
          </Link>
          
          <Link
            href="/dashboard"
            className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors inline-block"
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
          <p>אם יש לך שאלות, אנא צור קשר עם התמיכה.</p>
          <p>אנחנו כאן לעזור לך!</p>
        </div>
      </div>
    </div>
  );
}

export default function CancelPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CancelPageContent />
    </Suspense>
  );
}
