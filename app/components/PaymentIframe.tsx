'use client';

import { useEffect, useRef, useState } from 'react';
import { PaymentRedirectMessage } from '../types/checkout';

interface PaymentIframeProps {
  redirectUrl: string;
  orderId?: string;
  lowProfileId?: string;
  onPaymentComplete: (result: { status: 'success' | 'failed' | 'cancelled'; lpid: string; orderId?: string }) => void;
  onError?: (error: string) => void;
  language?: 'he' | 'en';
}

export default function PaymentIframe({
  redirectUrl,
  orderId,
  lowProfileId,
  onPaymentComplete,
  onError,
  language = 'he'
}: PaymentIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isHebrew = language === 'he';
  const cardcomOrigin = 'https://secure.cardcom.solutions';

  const deriveStatusFromRedirect = (urlString: string) => {
    try {
      const parsed = new URL(urlString);
      const path = parsed.pathname.toLowerCase();
      const status: 'success' | 'failed' | 'cancelled' =
        path.includes('failed') ? 'failed' : path.includes('cancel') ? 'cancelled' : 'success';

      return {
        status,
        orderId: parsed.searchParams.get('orderId') || parsed.searchParams.get('ReturnValue') || undefined,
        lpid: parsed.searchParams.get('lpid') || parsed.searchParams.get('lowprofilecode') || undefined,
      };
    } catch {
      return {};
    }
  };

  const updateOrderBeforeRedirect = async (orderNumber?: string) => {
    if (!orderNumber) return;
    try {
      await fetch('/api/payments/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderNumber }),
      });
    } catch (updateError) {
      console.warn('Failed to pre-update order before redirect', updateError);
    }
  };

  useEffect(() => {
    const handleCardcomRedirect = async (event: MessageEvent) => {
      const action = (event.data as any)?.action;
      const redirectValue = (event.data as any)?.value as string | undefined;

      if (action !== 'RedirectingCustOnCardcomPage' || !redirectValue) {
        return;
      }

      setIsLoading(false);
      setError(null);

      const derived = deriveStatusFromRedirect(redirectValue);
      const effectiveOrderId = derived.orderId || orderId;
      const effectiveLpid = derived.lpid || lowProfileId || '';

      await updateOrderBeforeRedirect(effectiveOrderId);

      if (derived.status) {
        onPaymentComplete({
          status: derived.status,
          lpid: effectiveLpid,
          orderId: effectiveOrderId,
        });
      }

      window.location.href = redirectValue;
    };

    const handleMessage = (event: MessageEvent) => {
      // Handle Cardcom iframe notifications
      if (event.origin === cardcomOrigin) {
        void handleCardcomRedirect(event);
        return;
      }

      // Verify origin for our own domain messages
      if (event.origin !== window.location.origin) {
        return;
      }

      const data = event.data as PaymentRedirectMessage;
      
      if (data?.type === 'CARD_PAYMENT_REDIRECT') {
        setIsLoading(false);
        onPaymentComplete({
          status: data.status,
          lpid: data.lpid,
          orderId: data.orderId
        });
      }
    };

    const handleIframeLoad = () => {
      setIsLoading(false);
      setError(null);
      try {
        iframeRef.current?.contentWindow?.postMessage({ command: 'stopRedirect' }, '*');
      } catch (postError) {
        console.warn('Unable to post stopRedirect to Cardcom iframe', postError);
      }
    };

    const handleIframeError = () => {
      setIsLoading(false);
      const errorMessage = isHebrew ? 'שגיאה בטעינת דף התשלום' : 'Error loading payment page';
      setError(errorMessage);
      onError?.(errorMessage);
    };

    // Add event listeners
    window.addEventListener('message', handleMessage);
    
    if (iframeRef.current) {
      iframeRef.current.addEventListener('load', handleIframeLoad);
      iframeRef.current.addEventListener('error', handleIframeError);
    }

    // Cleanup
    return () => {
      window.removeEventListener('message', handleMessage);
      if (iframeRef.current) {
        iframeRef.current.removeEventListener('load', handleIframeLoad);
        iframeRef.current.removeEventListener('error', handleIframeError);
      }
    };
  }, [onPaymentComplete, onError, isHebrew, orderId, lowProfileId]);

  return (
    <div className="w-full h-full flex flex-col">
      {isLoading && (
        <div className="flex items-center justify-center flex-1 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#856D55] mx-auto mb-4"></div>
            <p className="text-gray-600">
              {isHebrew ? 'טוען דף תשלום...' : 'Loading payment page...'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center flex-1 bg-red-50 rounded-lg">
          <div className="text-center">
            <div className="text-red-600 text-4xl mb-4">⚠️</div>
            <p className="text-red-800 font-medium mb-2">
              {isHebrew ? 'שגיאה בטעינת התשלום' : 'Payment Loading Error'}
            </p>
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setIsLoading(true);
                if (iframeRef.current) {
                  iframeRef.current.src = redirectUrl;
                }
              }}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              {isHebrew ? 'נסה שוב' : 'Try Again'}
            </button>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={redirectUrl}
        className={`w-full flex-1 border-0 rounded-lg ${isLoading || error ? 'hidden' : 'block'}`}
        allow="payment *; clipboard-write"
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
        title={isHebrew ? 'דף תשלום מאובטח' : 'Secure Payment Page'}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          const errorMessage = isHebrew ? 'שגיאה בטעינת דף התשלום' : 'Error loading payment page';
          setError(errorMessage);
          onError?.(errorMessage);
        }}
      />
    </div>
  );
}
