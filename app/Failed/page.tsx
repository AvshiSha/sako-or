'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function FailedPageContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<{
    orderId?: string;
    errorCode?: string;
    errorMessage?: string;
  }>({});

  useEffect(() => {
    // Extract parameters from URL
    const lpid = searchParams?.get('lpid'); // Low Profile ID
    const orderId = searchParams?.get('orderId');
    const errorCode = searchParams?.get('errorCode');
    const errorMessage = searchParams?.get('errorMessage');

    setErrorInfo({
      orderId: orderId || undefined,
      errorCode: errorCode || undefined,
      errorMessage: errorMessage || undefined,
    });

    setIsLoading(false);
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">מעבד את המידע...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Error Icon */}
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
          <svg
            className="h-8 w-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        {/* Error Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          התשלום נכשל
        </h1>
        
        <p className="text-gray-600 mb-6">
          מצטערים, התשלום לא עבר בהצלחה. אנא נסה שוב או צור קשר עם התמיכה.
        </p>

        {/* Error Details */}
        {(errorInfo.orderId || errorInfo.errorCode) && (
          <div className="bg-red-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-red-900 mb-2">פרטי השגיאה</h3>
            <div className="text-sm text-red-700 space-y-1">
              {errorInfo.orderId && (
                <p>מספר הזמנה: {errorInfo.orderId}</p>
              )}
              {errorInfo.errorCode && (
                <p>קוד שגיאה: {errorInfo.errorCode}</p>
              )}
              {errorInfo.errorMessage && (
                <p>הודעה: {errorInfo.errorMessage}</p>
              )}
            </div>
          </div>
        )}

        {/* Common Error Messages */}
        <div className="bg-yellow-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-yellow-900 mb-2">סיבות אפשריות:</h3>
          <ul className="text-sm text-yellow-800 text-right space-y-1">
            <li>• פרטי הכרטיס שגויים</li>
            <li>• יתרה לא מספקת</li>
            <li>• הכרטיס חסום</li>
            <li>• בעיה זמנית עם הבנק</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/cart"
            className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors inline-block"
          >
            נסה שוב
          </Link>
          
          <Link
            href="/contact"
            className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors inline-block"
          >
            צור קשר עם התמיכה
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
          <p>אם הבעיה נמשכת, אנא צור קשר עם התמיכה.</p>
          <p>אנחנו כאן לעזור לך!</p>
        </div>
      </div>
    </div>
  );
}

export default function FailedPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FailedPageContent />
    </Suspense>
  );
}
