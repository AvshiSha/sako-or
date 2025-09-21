'use client';

import { useState } from 'react';
import { CreatePaymentRequest } from '../types/cardcom';

interface PaymentResponse {
  success: boolean;
  paymentUrl?: string;
  lowProfileId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  error?: string;
  details?: string;
}

export function usePayment() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPayment = async (paymentData: CreatePaymentRequest): Promise<PaymentResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/create-low-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create payment');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  };

  const redirectToPayment = (paymentUrl: string) => {
    if (typeof window !== 'undefined') {
      window.location.href = paymentUrl;
    }
  };

  const openPaymentInIframe = (paymentUrl: string, containerId: string) => {
    if (typeof window !== 'undefined') {
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = `
          <iframe 
            src="${paymentUrl}" 
            width="100%" 
            height="600" 
            frameborder="0"
            style="border-radius: 8px;"
          ></iframe>
        `;
      }
    }
  };

  const processPayment = async (paymentData: CreatePaymentRequest, options: {
    useIframe?: boolean;
    iframeContainerId?: string;
  } = {}): Promise<PaymentResponse> => {
    const result = await createPayment(paymentData);
    
    if (result.success && result.paymentUrl) {
      if (options.useIframe && options.iframeContainerId) {
        openPaymentInIframe(result.paymentUrl, options.iframeContainerId);
      } else {
        redirectToPayment(result.paymentUrl);
      }
    }
    
    return result;
  };

  return {
    createPayment,
    processPayment,
    redirectToPayment,
    openPaymentInIframe,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}
