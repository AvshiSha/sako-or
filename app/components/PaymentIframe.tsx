'use client';

import { useEffect, useRef, useState } from 'react';
import { PaymentRedirectMessage } from '../types/checkout';
import { Button } from './ui/button';

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
    if (!orderNumber) {
      console.warn('[PaymentIframe] No order number provided for status check');
      return;
    }
    try {
      console.log('[PaymentIframe] Checking payment status for order:', orderNumber);
      const response = await fetch('/api/payments/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderNumber }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('[PaymentIframe] Status check failed:', response.status, errorData);
      } else {
        const result = await response.json().catch(() => ({}));
        console.log('[PaymentIframe] Status check completed:', result);
      }
    } catch (updateError) {
      console.error('[PaymentIframe] Failed to pre-update order before redirect', updateError);
      // Don't throw - webhook will handle it as fallback
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

      // Wait for check-status to complete before redirecting
      try {
        await updateOrderBeforeRedirect(effectiveOrderId);
        console.log('[PaymentIframe] Order status updated before redirect');
      } catch (updateError) {
        console.error('[PaymentIframe] Failed to update order status:', updateError);
        // Continue anyway - webhook will handle it
      }

      if (derived.status) {
        onPaymentComplete({
          status: derived.status,
          lpid: effectiveLpid,
          orderId: effectiveOrderId,
        });
      }

      // Small delay to ensure status update completes and webhook can process
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
      {/* Loading and error states for the gateway sheet. Neither is drawn in
          Figma, so both compose from approved constructions rather than invent
          anything: the ground is the same `surface-secondary` the sheet around
          this component already uses (CheckoutClient / CheckoutModal), corners
          are square, and there is no shadow - the design system documents no
          elevation at all. */}
      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-1 items-center justify-center bg-surface-secondary"
        >
          <div className="text-center">
            {/* The storefront's v5 spinner, as drawn on the PDP and the profile
                shell: same geometry, on border-default rather than a literal hex.
                This carried #856D55 - the pre-v5 brand brown - until now. */}
            <div className="mx-auto mb-[16px] h-12 w-12 animate-spin rounded-full border-b-2 border-border-default" />
            {/* Typography/Body/Small - 14px Ploni. */}
            <p className="font-ploni text-[14px] text-text-secondary">
              {isHebrew ? 'טוען דף תשלום...' : 'Loading payment page...'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex flex-1 items-center justify-center bg-surface-secondary p-[16px]"
        >
          {/* Error is signalled the one way the system signals it: a 2px rule on
              the inline-start edge in accent-error, never a coloured fill. There
              is no red surface and no warning glyph in the palette - the 16
              primitives carry no icon set and no success hue, so a filled red
              panel would be inventing brand colour. Start-aligned because the
              rule is on the inline start; `border-s` so it follows the locale. */}
          <div className="w-full max-w-[360px] border-s-2 border-accent-error ps-[16px] text-start">
            <p className="font-ploni text-[16px] font-bold text-text-primary">
              {isHebrew ? 'שגיאה בטעינת התשלום' : 'Payment Loading Error'}
            </p>
            <p className="mt-[8px] font-ploni text-[14px] text-text-secondary">{error}</p>
            {/* CTA Button State=Filled at the height the system draws it (54px),
                rather than the hand-rolled red button this replaces. */}
            <Button
              type="button"
              variant="sako"
              size="sakoBar"
              className="mt-[24px]"
              onClick={() => {
                setError(null);
                setIsLoading(true);
                if (iframeRef.current) {
                  iframeRef.current.src = redirectUrl;
                }
              }}
            >
              {isHebrew ? 'נסה שוב' : 'Try Again'}
            </Button>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={redirectUrl}
        className={`w-full flex-1 border-0 ${isLoading || error ? 'hidden' : 'block'}`}
        allow="payment *; clipboard-write"
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation" // remove allow-same-origin
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
