'use client';

import { useEffect, useState } from 'react';
import { PaymentStatus, PaymentStatusResponse } from '../types/checkout';
import Link from 'next/link';

interface PaymentResultProps {
  lpid: string;
  orderId?: string;
  initialStatus: PaymentStatus;
  onRetry?: () => void;
  language?: 'he' | 'en';
}

export default function PaymentResult({
  lpid,
  orderId,
  initialStatus,
  onRetry,
  language = 'he'
}: PaymentResultProps) {
  const [status, setStatus] = useState<PaymentStatus>(initialStatus);
  const [paymentData, setPaymentData] = useState<PaymentStatusResponse | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isHebrew = language === 'he';

  // Poll for payment status
  const pollPaymentStatus = async () => {
    try {
      const response = await fetch(`/api/payments/by-low-profile-id?lpid=${lpid}`);
      if (!response.ok) {
        throw new Error('Failed to fetch payment status');
      }
      
      const data: PaymentStatusResponse = await response.json();
      setPaymentData(data);
      setStatus(data.status);
      
      // Stop polling if we have a final status
      if (data.status === 'success' || data.status === 'failed' || data.status === 'cancelled') {
        setIsPolling(false);
      }
    } catch (err) {
      console.error('Error polling payment status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsPolling(false);
    }
  };

  useEffect(() => {
    // Start polling if status is pending
    if (initialStatus === 'pending') {
      setIsPolling(true);
      pollPaymentStatus();
      
      // Poll every 2 seconds for up to 30 seconds
      const interval = setInterval(() => {
        pollPaymentStatus();
      }, 2000);
      
      const timeout = setTimeout(() => {
        setIsPolling(false);
        clearInterval(interval);
      }, 30000);
      
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [lpid, initialStatus]);

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case 'success':
        return '✅';
      case 'failed':
        return '❌';
      case 'cancelled':
        return '⚠️';
      case 'pending':
        return '⏳';
      default:
        return '❓';
    }
  };

  const getStatusMessage = (status: PaymentStatus) => {
    if (isHebrew) {
      switch (status) {
        case 'success':
          return 'התשלום בוצע בהצלחה!';
        case 'failed':
          return 'התשלום נכשל';
        case 'cancelled':
          return 'התשלום בוטל';
        case 'pending':
          return 'ממתין לאישור התשלום...';
        default:
          return 'סטטוס לא ידוע';
      }
    } else {
      switch (status) {
        case 'success':
          return 'Payment Successful!';
        case 'failed':
          return 'Payment Failed';
        case 'cancelled':
          return 'Payment Cancelled';
        case 'pending':
          return 'Waiting for payment confirmation...';
        default:
          return 'Unknown status';
      }
    }
  };

  const getStatusDescription = (status: PaymentStatus) => {
    if (isHebrew) {
      switch (status) {
        case 'success':
          return 'הזמנתך התקבלה ותעובד בקרוב. תקבל אישור במייל.';
        case 'failed':
          return 'התשלום לא הצליח. אנא נסה שוב או צור קשר עם התמיכה.';
        case 'cancelled':
          return 'התשלום בוטל. תוכל לנסות שוב בכל עת.';
        case 'pending':
          return 'אנחנו ממתינים לאישור התשלום מהבנק. זה יכול לקחת כמה דקות.';
        default:
          return '';
      }
    } else {
      switch (status) {
        case 'success':
          return 'Your order has been received and will be processed soon. You will receive a confirmation email.';
        case 'failed':
          return 'Payment was not successful. Please try again or contact support.';
        case 'cancelled':
          return 'Payment was cancelled. You can try again anytime.';
        case 'pending':
          return 'We are waiting for payment confirmation from the bank. This may take a few minutes.';
        default:
          return '';
      }
    }
  };

  return (
    <div className="text-center space-y-6">
      {/* Status Icon and Message */}
      <div className="space-y-4">
        <div className="text-6xl">{getStatusIcon(status)}</div>
        <div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            {getStatusMessage(status)}
          </h3>
          <p className="text-gray-600">
            {getStatusDescription(status)}
          </p>
        </div>
      </div>

      {/* Loading Spinner for Pending */}
      {status === 'pending' && isPolling && (
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">
            {isHebrew ? 'בודק סטטוס...' : 'Checking status...'}
          </span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Order Details for Success */}
      {status === 'success' && paymentData && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-left">
          <h4 className="font-semibold text-green-800 mb-4">
            {isHebrew ? 'פרטי ההזמנה' : 'Order Details'}
          </h4>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">
                {isHebrew ? 'מספר הזמנה:' : 'Order Number:'}
              </span>
              <span className="font-medium">{paymentData.order.orderNumber}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">
                {isHebrew ? 'סכום:' : 'Amount:'}
              </span>
              <span className="font-medium">
                {paymentData.order.total.toFixed(2)} {paymentData.order.currency}
              </span>
            </div>
            
            {paymentData.transaction && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    {isHebrew ? '4 ספרות אחרונות:' : 'Last 4 digits:'}
                  </span>
                  <span className="font-medium">****{paymentData.transaction.last4Digits}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    {isHebrew ? 'סוג כרטיס:' : 'Card Type:'}
                  </span>
                  <span className="font-medium">{paymentData.transaction.cardBrand}</span>
                </div>
              </>
            )}
            
            <div className="flex justify-between">
              <span className="text-gray-600">
                {isHebrew ? 'תאריך:' : 'Date:'}
              </span>
              <span className="font-medium">
                {new Date(paymentData.order.createdAt).toLocaleDateString(isHebrew ? 'he-IL' : 'en-US')}
              </span>
            </div>
          </div>

          {paymentData.documentUrl && (
            <div className="mt-4 pt-4 border-t border-green-200">
              <a
                href={paymentData.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-green-700 hover:text-green-800 font-medium"
              >
                📄 {isHebrew ? 'הורד חשבונית/קבלה' : 'Download Invoice/Receipt'}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {status === 'success' && (
          <Link
            href="/"
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            {isHebrew ? 'חזור לעמוד הבית' : 'Back to Home'}
          </Link>
        )}
        
        {(status === 'failed' || status === 'cancelled') && onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            {isHebrew ? 'נסה שוב' : 'Try Again'}
          </button>
        )}
        
        <Link
          href="/cart"
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          {isHebrew ? 'חזור לעגלה' : 'Back to Cart'}
        </Link>
      </div>

      {/* Support Information */}
      <div className="text-sm text-gray-500">
        <p>
          {isHebrew 
            ? 'יש לך שאלות? צור קשר עם התמיכה שלנו'
            : 'Have questions? Contact our support'
          }
        </p>
        <p>
          {isHebrew 
            ? 'אימייל: support@sako-or.com | טלפון: 03-1234567'
            : 'Email: support@sako-or.com | Phone: 03-1234567'
          }
        </p>
      </div>
    </div>
  );
}
