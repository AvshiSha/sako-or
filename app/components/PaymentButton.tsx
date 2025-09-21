'use client';

import { useState } from 'react';
import { usePayment } from '../hooks/usePayment';
import { CreatePaymentRequest } from '../types/cardcom';

interface PaymentButtonProps {
  orderId: string;
  amount: number;
  currency?: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  productName?: string;
  createToken?: boolean;
  createDocument?: boolean;
  className?: string;
  children?: React.ReactNode;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
}

export default function PaymentButton({
  orderId,
  amount,
  currency = 'ILS',
  customerEmail,
  customerName,
  customerPhone,
  productName,
  createToken = false,
  createDocument = false,
  className = '',
  children,
  onSuccess,
  onError,
}: PaymentButtonProps) {
  const { processPayment, isLoading, error } = usePayment();
  const [showIframe, setShowIframe] = useState(false);

  const handlePayment = async () => {
    const paymentData: CreatePaymentRequest = {
      orderId,
      amount,
      currency,
      customerEmail,
      customerName,
      customerPhone,
      productName,
      createToken,
      createDocument,
    };

    const result = await processPayment(paymentData, {
      useIframe: showIframe,
      iframeContainerId: 'payment-iframe-container',
    });

    if (result.success) {
      onSuccess?.(result);
    } else {
      onError?.(result.error || 'Payment failed');
    }
  };

  const toggleIframe = () => {
    setShowIframe(!showIframe);
  };

  return (
    <div className="space-y-4">
      {/* Payment Options */}
      <div className="flex gap-2">
        <button
          onClick={handlePayment}
          disabled={isLoading}
          className={`flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
        >
          {isLoading ? 'יוצר תשלום...' : children || 'שלם עכשיו'}
        </button>
        
        <button
          onClick={toggleIframe}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          title={showIframe ? 'תשלום בדף נפרד' : 'תשלום בחלון'}
        >
          {showIframe ? '🔗' : '🖼️'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Iframe Container */}
      {showIframe && (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-900">תשלום מאובטח</h3>
            <button
              onClick={toggleIframe}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div id="payment-iframe-container" className="min-h-[600px]">
            {/* Iframe will be inserted here */}
          </div>
        </div>
      )}

      {/* Payment Info */}
      <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
        <div className="flex justify-between">
          <span>סכום לתשלום:</span>
          <span className="font-semibold">
            {amount.toFixed(2)} {currency}
          </span>
        </div>
        {createToken && (
          <p className="text-xs text-blue-600 mt-1">
            💳 הכרטיס יישמר לתשלומים עתידיים
          </p>
        )}
        {createDocument && (
          <p className="text-xs text-green-600 mt-1">
            📄 יופק חשבונית/קבלה
          </p>
        )}
      </div>
    </div>
  );
}
