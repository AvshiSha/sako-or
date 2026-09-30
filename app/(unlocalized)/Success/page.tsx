'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Footer from '@/app/components/Footer';
import { trackPurchase, PurchaseUserProperties } from '@/lib/dataLayer';
import { useAuth } from '@/app/contexts/AuthContext';
import { clearCartAfterPurchase } from '@/lib/cart-clear';

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState<{
    orderId?: string;
    amount?: number;
    currency?: string;
  }>({});
  const hasTrackedRef = useRef(false);
  const hasClearedCartRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    // Extract parameters from URL
    const lpid = searchParams?.get('lpid') || searchParams?.get('lowprofilecode'); // Low Profile ID
    const orderId = searchParams?.get('orderId') || searchParams?.get('ReturnValue'); // CardCom uses ReturnValue
    const amount = searchParams?.get('amount');
    const currency = searchParams?.get('currency');
    const responseCode = searchParams?.get('ResponseCode') || searchParams?.get('ResponeCode'); // CardCom response code (0 = success)
    
    // Debug: log all URL parameters
    console.log('Success page URL parameters:', {
      lpid,
      orderId,
      amount,
      currency,
      responseCode,
      allParams: Object.fromEntries(searchParams?.entries() || [])
    });

    // Send postMessage to parent if in iframe
    if (window.parent && window.parent !== window) {
      const message = {
        type: 'CARD_PAYMENT_REDIRECT',
        status: 'success' as const,
        lpid: lpid || '',
        orderId: orderId || undefined
      };
      window.parent.postMessage(message, window.location.origin);
    }

    // If ResponseCode is 0, payment was successful - verify and update status
    if (responseCode === '0' && (lpid || orderId)) {
      if (lpid) {
        verifyPaymentStatus(lpid, orderId, true); // Pass paymentSucceededFromUrl flag
      } else if (orderId) {
        verifyPaymentStatus('', orderId, true); // Pass paymentSucceededFromUrl flag
      }
    } else if (lpid) {
      // Even without ResponseCode, try to verify if we have LPID
      verifyPaymentStatus(lpid, orderId, false);
    }

    setOrderInfo({
      orderId: orderId || undefined,
      amount: amount ? parseFloat(amount) : undefined,
      currency: currency || 'ILS',
    });

    // Track purchase event for GA4 data layer (use ref to avoid stale closure in async callbacks)
    // Fire if we have either LPID or OrderId; derive values from backend if not in URL
    if (!hasTrackedRef.current && (lpid || orderId)) {
      hasTrackedRef.current = true;
      try {
        // Fetch order details from API (prefer LPID)
        const url = lpid
          ? `/api/payments/by-low-profile-id?lpid=${encodeURIComponent(lpid)}`
          : `/api/payments/by-low-profile-id?orderId=${encodeURIComponent(orderId as string)}`;

        fetch(url)
          .then(res => res.json())
          .then(data => {
            const order = data?.order;
            if (order && Array.isArray(order.orderItems) && order.orderItems.length > 0) {
              const orderItems = order.orderItems.map((item: any) => ({
                name: item.productName || 'Unknown Product',
                id: item.productSku || 'unknown',
                price: item.price || 0,
                brand: undefined,
                categories: undefined,
                variant: item.size || undefined,
                quantity: item.quantity || 1
              }));

              // Get user properties from checkout if available
              const userProperties: PurchaseUserProperties = {
                customer_email: order.customerEmail || undefined,
                user_id: undefined,
                customer_first_name: undefined,
                customer_last_name: undefined,
                customer_phone: undefined,
                customer_city: undefined,
                customer_zip: undefined,
                customer_address_1: undefined,
                customer_address_2: undefined,
                customer_country: undefined,
                customer_province: undefined
              };

              trackPurchase(
                order.orderNumber || orderId,
                orderItems,
                {
                  currency: order.currency || currency || 'ILS',
                  value: typeof order.total === 'number' ? order.total : (amount ? parseFloat(amount) : undefined),
                  tax: typeof order.tax === 'number' ? order.tax : undefined,
                  shipping: typeof order.deliveryFee === 'number' ? order.deliveryFee : undefined,
                  affiliation: 'Sako Online Store',
                  userProperties: userProperties
                }
              );
            } else {
              // Fallback: track purchase with minimal data
              trackPurchase(
                order?.orderNumber || orderId || 'unknown',
                [{
                  name: 'Order',
                  id: 'order',
                  price: order?.total ?? (amount ? parseFloat(amount) : 0),
                  quantity: 1
                }],
                {
                  currency: order?.currency || currency || 'ILS',
                  value: order?.total ?? (amount ? parseFloat(amount) : 0),
                  affiliation: 'Sako Online Store'
                }
              );
            }
          })
          .catch(err => {
            console.error('Error fetching order details for tracking:', err);
            // Fallback: track purchase with minimal data
            trackPurchase(
              orderId || 'unknown',
              [{
                name: 'Order',
                id: 'order',
                price: amount ? parseFloat(amount) : 0,
                quantity: 1
              }],
              {
                currency: currency || 'ILS',
                value: amount ? parseFloat(amount) : 0,
                affiliation: 'Sako Online Store'
              }
            );
          });
      } catch (error) {
        console.error('Error tracking purchase:', error);
        hasTrackedRef.current = false; // allow retry if sync path failed
      }
    }

    // Track Google Ads conversion event
    // TODO: Replace 'AW-CONVERSION_ID/CONVERSION_LABEL' with your actual Google Ads conversion ID and label
    // You can find this in your Google Ads account under Tools & Settings > Conversions
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'conversion', {
        send_to: 'AW-CONVERSION_ID/CONVERSION_LABEL',
        value: amount ? parseFloat(amount) : orderInfo.amount,
        currency: currency || 'ILS',
        transaction_id: orderId || orderInfo.orderId || undefined
      });
    }

    setIsLoading(false);
  }, [searchParams]);

  const verifyPaymentStatus = async (
    lpid: string,
    orderId?: string | null,
    paymentSucceededFromUrl: boolean = false,
    retryCount: number = 0
  ) => {
    const maxRetries = 1;
    try {
      console.log('Verifying payment status:', { lpid, orderId, paymentSucceededFromUrl, retryCount });
      
      let paymentConfirmed = false;
      
      // First, get the order to find the orderNumber
      if (lpid) {
        try {
          const statusResponse = await fetch(`/api/payments/by-low-profile-id?lpid=${encodeURIComponent(lpid)}`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            const orderNumber = statusData?.order?.orderNumber;
            
            if (orderNumber) {
              // Call check-status with paymentSucceeded flag (we're on Success page, so payment succeeded)
              console.log('Calling check-status for order:', orderNumber);
              const checkStatusResponse = await fetch('/api/payments/check-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  orderId: orderNumber,
                  paymentSucceeded: paymentSucceededFromUrl // Flag indicating payment succeeded (from Success page)
                }),
              }).catch(err => {
                console.warn('Failed to check/update payment status:', err);
                return null;
              });
              
              if (checkStatusResponse?.ok) {
                const checkStatusData = await checkStatusResponse.json().catch(() => ({}));
                // Payment is confirmed if status is completed or if we got a successful response
                paymentConfirmed = checkStatusData?.status === 'completed' || paymentSucceededFromUrl;
              }
            }
          }
        } catch (fetchError) {
          console.error('Failed to verify payment status:', fetchError);
        }
      } else if (orderId) {
        // If we have orderId directly, use it
        console.log('Calling check-status for order:', orderId);
        const checkStatusResponse = await fetch('/api/payments/check-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            orderId,
            paymentSucceeded: paymentSucceededFromUrl // Flag indicating payment succeeded (from Success page)
          }),
        }).catch(err => {
          console.warn('Failed to check/update payment status:', err);
          return null;
        });
        
        if (checkStatusResponse?.ok) {
          const checkStatusData = await checkStatusResponse.json().catch(() => ({}));
          // Payment is confirmed if status is completed or if we got a successful response
          paymentConfirmed = checkStatusData?.status === 'completed' || paymentSucceededFromUrl;
        }
      }
      
      // Clear cart after payment is confirmed (only once) - use ref to avoid stale closure
      const shouldClear = (paymentConfirmed || paymentSucceededFromUrl) && !hasClearedCartRef.current;
      if (shouldClear) {
        hasClearedCartRef.current = true;
        const uid = userRef.current?.uid;
        setTimeout(() => {
          clearCartAfterPurchase(uid);
        }, 1000);
      }
      
    } catch (error) {
      console.error('Failed to verify payment:', error);
      if (retryCount < maxRetries) {
        setTimeout(() => {
          verifyPaymentStatus(lpid, orderId, paymentSucceededFromUrl, retryCount + 1);
        }, 2000);
      }
    }
  };

  if (isLoading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-screen flex-col items-center justify-center bg-surface-secondary px-[16px]"
      >
        <p className="font-ploni text-[25px] font-black leading-[25px] tracking-[-1.4px] text-text-primary">
          SAKO OR
        </p>
        <p className="mt-[30px] font-ploni text-[11px] leading-[20.8px] tracking-[1.69px] text-text-primary">
          VERIFYING PAYMENT
        </p>
        <p className="mt-[8px] font-ploni text-[13px] leading-[20.8px] text-text-primary">
          מאמתים את התשלום…
        </p>
      </div>
    );
  }

  // "תודה, מאיה." in the frame. Guest checkout has no account to read a name
  // from, so the greeting closes after "תודה" rather than printing an empty slot.
  const firstName = user?.displayName?.trim().split(/\s+/)[0] || '';
  const thanks = firstName
    ? `תודה, ${firstName}. אישור ההזמנה נשלח אלייך במייל. נעדכן אותך שוב ברגע שהחבילה תצא לדרך.`
    : 'תודה. אישור ההזמנה נשלח אלייך במייל. נעדכן אותך שוב ברגע שהחבילה תצא לדרך.';

  return (
    // dir="rtl" here rather than on the layout: this group deliberately sets no
    // direction, because it also holds the left-to-right admin panel.
    <div dir="rtl" className="flex min-h-screen flex-col bg-surface-secondary">
      {/* 438:3901 — one centred column. The frame carries the wordmark itself
          rather than the site header, because the gateway returns here outside
          the storefront shell. */}
      <main className="flex flex-1 flex-col items-center px-[16px] pt-[72px] pb-[50px]">
        <p className="font-ploni text-[25px] font-black leading-[25px] tracking-[-1.4px] text-text-primary">
          SAKO OR
        </p>

        {/* 438:3905, a 33x33 design asset. Intrinsic size preserved — not scaled
            to a utility — and inline rather than through next/image, which would
            add an optimizer round trip for 958 bytes. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/sako/order-confirmed-check.svg"
          width={33}
          height={33}
          alt=""
          aria-hidden="true"
          className="mt-[105px]"
        />

        {/* The frame prints "#SO-02481". A real order number only exists once the
            gateway has handed one back, so the divider and number drop out
            together rather than leaving a bare "#". */}
        <p className="mt-[30px] mb-[20px] text-center font-ploni text-[11px] leading-[20.8px] tracking-[1.69px] text-text-primary">
          {orderInfo.orderId ? `ORDER CONFIRMED / #${orderInfo.orderId}` : 'ORDER CONFIRMED'}
        </p>

        {/* The frame specifies Ploni UltraBold; this project ships Regular,
            DemiBold, Bold and Black, so the heading takes Black (900) — the
            nearest weight we actually load rather than a synthesized one. */}
        <h1 className="pt-[13px] text-center font-ploni text-[60px] font-black leading-[50px] text-text-primary">
          ההזמנה
          <br />
          בדרך.
        </h1>

        <p className="mt-[12px] max-w-[319px] text-center font-ploni text-[13px] leading-[20.8px] text-text-primary">
          {thanks}
        </p>

        {/* Back to the Hebrew storefront: this route is unlocalized, so there is
            no [lng] to inherit and the destination has to be named. */}
        <Link
          href="/he"
          className="mt-[20px] flex h-[44px] items-end border-b border-border-default pb-[6px] font-ploni text-[11px] text-text-primary transition-opacity hover:opacity-60"
        >
          חזרה לחנות ↙
        </Link>
      </main>

      <Footer lng="he" />
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-secondary" />}>
      <SuccessPageContent />
    </Suspense>
  );
}
