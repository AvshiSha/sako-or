'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckoutStep, CheckoutFormData, CreateLowProfileRequest, CreateLowProfileResponse } from '../types/checkout';
import PayerDetailsForm from './PayerDetailsForm';
import PaymentIframe from './PaymentIframe';
import OrderSummary from './OrderSummary';
import { trackBeginCheckout } from '@/lib/dataLayer';
import { CartItem } from '../hooks/useCart';
import { ArrowLeftIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  amount: number;
  subtotal?: number;
  discountTotal?: number;
  deliveryFee?: number;
  currency?: string;
  productName?: string;
  productSku?: string;
  quantity?: number;
  language?: 'he' | 'en';
  items?: CartItem[];
  appliedCoupons?: Array<{
    code: string;
    discountAmount: number;
    discountType: 'percent_all' | 'percent_specific' | 'fixed' | 'bogo';
    stackable: boolean;
    description?: string;
    discountLabel?: { en: string; he: string };
  }>;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  orderId,
  amount,
  subtotal = 0,
  discountTotal = 0,
  deliveryFee = 0,
  currency = 'ILS',
  productName = 'Sako Order',
  productSku = 'UNKNOWN',
  quantity = 1,
  language = 'he',
  items = [],
  appliedCoupons = []
}: CheckoutModalProps) {
  const [step, setStep] = useState<CheckoutStep>('INFO');
  const [formData, setFormData] = useState<CheckoutFormData>({
    payer: {
      firstName: '',
      lastName: '',
      email: '',
      mobile: '',
      idNumber: ''
    },
    deliveryAddress: {
      city: '',
      streetName: '',
      streetNumber: '',
      floor: '',
      apartmentNumber: '',
      zipCode: ''
    },
    notes: ''
  });
  const [isFormValid, setIsFormValid] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string>('');
  const [lowProfileId, setLowProfileId] = useState<string>('');
  const [createdOrderId, setCreatedOrderId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOrderSummaryOpen, setIsOrderSummaryOpen] = useState(false);
  const checkoutTrackedSignatureRef = useRef<string | null>(null);
  const historyStateRef = useRef<number | null>(null);
  const shouldPopHistoryRef = useRef(false);

  const isHebrew = language === 'he';
  const isRTL = isHebrew;

  // Calculate final total
  const finalTotal = useMemo(() => {
    const discountedSubtotal = Math.max((subtotal || 0) - (discountTotal || 0), 0);
    return Math.max(discountedSubtotal + (deliveryFee || 0), 0);
  }, [subtotal, discountTotal, deliveryFee]);

  const checkoutItems = useMemo(() => {
    if (!items?.length) return [];

    return items.map((item) => ({
      name: item.name[language as 'en' | 'he'] || 'Unknown Product',
      id: item.sku,
      price: item.salePrice || item.price,
      brand: undefined,
      categories: undefined,
      variant: [item.size, item.color].filter(Boolean).join('-') || undefined,
      quantity: item.quantity,
    }));
  }, [items, language]);

  // Reset modal when opened
  useEffect(() => {
    if (isOpen) {
      setStep('INFO');
      setFormData({
        payer: {
          firstName: '',
          lastName: '',
          email: '',
          mobile: '',
          idNumber: ''
        },
        deliveryAddress: {
          city: '',
          streetName: '',
          streetNumber: '',
          floor: '',
          apartmentNumber: '',
          zipCode: ''
        },
        notes: ''
      });
      setRedirectUrl('');
      setLowProfileId('');
      setCreatedOrderId('');
      setError(null);
      setIsLoading(false);
      setIsOrderSummaryOpen(false);
      
      // Push state to history for browser back button
      if (typeof window !== 'undefined') {
        historyStateRef.current = window.history.length;
        shouldPopHistoryRef.current = true;
        window.history.pushState({ checkout: true }, '');
      }
    }
  }, [isOpen]);

  // Handle browser back button
  useEffect(() => {
    if (!isOpen || !shouldPopHistoryRef.current) return;

    const handlePopState = (event: PopStateEvent) => {
      if (step === 'PAYMENT') {
        // Go back to INFO step
        setStep('INFO');
        setRedirectUrl('');
        setLowProfileId('');
        setCreatedOrderId('');
        setError(null);
        setIsLoading(false);
        // Push state again to maintain history
        window.history.pushState({ checkout: true }, '');
      } else if (step === 'INFO') {
        // Exit checkout - allow default behavior
        shouldPopHistoryRef.current = false;
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, step, onClose]);

  // Cleanup history state on close
  useEffect(() => {
    if (!isOpen && historyStateRef.current !== null && shouldPopHistoryRef.current) {
      // Go back in history if we pushed a state and user closed normally
      if (typeof window !== 'undefined' && window.history.length > historyStateRef.current) {
        window.history.back();
      }
      historyStateRef.current = null;
      shouldPopHistoryRef.current = false;
    }
  }, [isOpen]);

  // Track begin_checkout when the modal opens
  useEffect(() => {
    if (!isOpen || checkoutItems.length === 0) return;

    const signature = JSON.stringify(checkoutItems);
    if (checkoutTrackedSignatureRef.current === signature) return;

    try {
      trackBeginCheckout(checkoutItems, currency);
      checkoutTrackedSignatureRef.current = signature;
    } catch (dataLayerError) {
      console.warn('Data layer tracking error:', dataLayerError);
    }
  }, [isOpen, checkoutItems, currency]);

  // Order summary state is controlled by user toggle - no auto-open/close

  // Handle form data changes
  const handleFormChange = (newFormData: CheckoutFormData) => {
    setFormData(newFormData);
  };

  // Handle form validation
  const handleValidChange = (isValid: boolean) => {
    setIsFormValid(isValid);
  };

  // Save checkout information first
  const saveCheckoutInfo = async (): Promise<string> => {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to save checkout information');
    }

    const result = await response.json();
    return result.checkoutId;
  };

  // Create Low Profile payment session
  const createPaymentSession = async (): Promise<CreateLowProfileResponse> => {
    const orderItems = items && items.length > 0
      ? items.map(item => ({
          productName: item.name[language as 'en' | 'he'] || productName,
          productSku: item.sku,
          quantity: item.quantity,
          price: item.salePrice || item.price,
          color: item.color,
          size: item.size,
        }))
      : undefined;

    const payload: CreateLowProfileRequest = {
      orderId,
      amount,
      currencyIso: currency === 'USD' ? 2 : 1,
      language: isHebrew ? 'he' : 'en',
      productName,
      productSku,
      quantity,
      items: orderItems,
      customer: formData.payer,
      deliveryAddress: formData.deliveryAddress,
      notes: formData.notes,
      subtotal,
      discountTotal,
      deliveryFee,
      coupons: appliedCoupons.map(coupon => ({
        code: coupon.code,
        discountAmount: coupon.discountAmount,
        discountType: coupon.discountType,
        stackable: coupon.stackable,
        description: coupon.description
      })),
      ui: {
        isCardOwnerPhoneRequired: true,
        cssUrl: `${window.location.origin}/cardcom.css`
      },
      advanced: {
        jValidateType: 5,
        threeDSecureState: 'Auto',
        minNumOfPayments: 1,
        maxNumOfPayments: 1
      }
    };

    const response = await fetch('/api/payments/create-low-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
      console.error('Payment session creation failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      throw new Error(errorMessage);
    }

    return response.json();
  };

  // Handle payment submission
  const handlePaymentSubmit = async () => {
    if (!isFormValid) return;

    setStep('CREATING_LP');
    setIsLoading(true);
    setError(null);

    try {
      const checkoutId = await saveCheckoutInfo();
      const result = await createPaymentSession();
      
      if (result.success) {
        setRedirectUrl(result.paymentUrl);
        setLowProfileId(result.lowProfileId || '');
        setCreatedOrderId(result.orderId || orderId);
        setStep('PAYMENT');
        setIsLoading(false);
      } else {
        throw new Error(result.error || 'Failed to create payment session');
      }
    } catch (err) {
      console.error('Payment creation error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setStep('INFO');
      setIsLoading(false);
    }
  };

  // Handle payment completion
  // Note: This is called before redirect, but we don't need to show PaymentResult
  // since we immediately redirect to Success/Failed pages
  const handlePaymentComplete = (_result: { status: 'success' | 'failed' | 'cancelled'; lpid: string; orderId?: string }) => {
    // No-op: redirect happens immediately in PaymentIframe
  };

  // Handle payment error
  const handlePaymentError = (error: string) => {
    setError(error);
    setStep('INFO');
  };

  // Handle retry
  const handleRetry = () => {
    setStep('INFO');
    setError(null);
  };

  // Handle back button click
  const handleBack = () => {
    if (step === 'PAYMENT') {
      setStep('INFO');
      setRedirectUrl('');
      setLowProfileId('');
      setCreatedOrderId('');
      setError(null);
      setIsLoading(false);
      // Update history to reflect INFO step
      if (typeof window !== 'undefined' && shouldPopHistoryRef.current) {
        window.history.pushState({ checkout: true, step: 'INFO' }, '');
      }
    } else if (step === 'INFO') {
      shouldPopHistoryRef.current = false;
      onClose();
    }
  };

  // Handle modal close
  const handleClose = () => {
    if (step === 'PAYMENT') {
      // Don't allow closing during payment
      return;
    }
    onClose();
  };

  // Handle ESC key and body scroll lock
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && step !== 'PAYMENT') {
        handleClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEsc);
      
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEsc);
      };
    }
  }, [isOpen, step]);

  if (!isOpen) return null;

  const t = {
    backToCheckout: isHebrew ? 'חזרה לתשלום' : 'Back to checkout',
    showOrderSummary: isHebrew ? 'הצג סיכום הזמנה' : 'Show order summary',
    hideOrderSummary: isHebrew ? 'הסתר סיכום הזמנה' : 'Hide order summary',
    info: isHebrew ? 'פרטים' : 'INFO',
    payment: isHebrew ? 'תשלום' : 'PAYMENT',
    brand: 'SAKO OR',
  };

  const canGoToPayment = step === 'INFO' && isFormValid;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 bg-opacity-50 transition-opacity" onClick={handleClose} />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full h-[85vh] flex flex-col">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 flex-shrink-0">
            {/* Row 1: Logo and Back Arrow */}
            <div className="flex items-center justify-between p-4 pb-3">
              {/* Left: Brand name */}
              <div className="text-xl font-bold text-gray-900">
                {t.brand}
              </div>

              {/* Right: Back arrow (no text) */}
              <button
                onClick={handleBack}
                className="text-gray-700 hover:text-gray-900 transition-colors"
                aria-label={isHebrew ? 'חזרה' : 'Back'}
              >
                <ArrowLeftIcon className={`h-6 w-6 ${isRTL ? '' : 'rotate-180'}`} />
              </button>
            </div>

            {/* Row 2: Order Summary Toggle and Total */}
            <div className="flex items-center justify-between px-4 pb-3">
              {/* Left: Order summary toggle */}
              <button
                onClick={() => setIsOrderSummaryOpen(!isOrderSummaryOpen)}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1"
              >
                <span>{isOrderSummaryOpen ? t.hideOrderSummary : t.showOrderSummary}</span>
                {isOrderSummaryOpen ? (
                  <ChevronUpIcon className="h-4 w-4" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4" />
                )}
              </button>

              {/* Right: Total amount */}
              <div className="text-lg font-bold text-gray-900">
                ₪{finalTotal.toFixed(2)}
              </div>
            </div>

            {/* Row 3: Step Indicator - Only this row reverses for RTL */}
            <div className="px-4 pb-4">
              <div className={`flex items-center gap-2 text-sm ${isRTL ? 'justify-start' : 'justify-start'}`}>
                <button
                  onClick={() => {
                    if (step === 'PAYMENT') {
                      setStep('INFO');
                      setRedirectUrl('');
                      setLowProfileId('');
                      setCreatedOrderId('');
                      setError(null);
                      setIsLoading(false);
                    }
                  }}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    step === 'INFO'
                      ? 'bg-[#856D55]/90 text-white font-medium'
                      : step === 'PAYMENT'
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  1. {t.info}
                </button>
                <span className="text-gray-400">{isRTL ? '←' : '→'}</span>
                <button
                  onClick={() => {
                    if (canGoToPayment) {
                      handlePaymentSubmit();
                    }
                  }}
                  disabled={!canGoToPayment}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    step === 'PAYMENT'
                      ? 'bg-[#856D55]/90 text-white font-medium'
                      : canGoToPayment
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  2. {t.payment}
                </button>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden relative min-h-0">
            {/* Main Content - Always full width, not affected by order summary */}
            <div className={`w-full h-full overflow-y-auto p-6 ${step === 'PAYMENT' ? 'flex flex-col min-h-0' : ''}`}>
              {step === 'INFO' && (
                <div className="space-y-6 text-gray-900">
                  <PayerDetailsForm
                    formData={formData}
                    onFormChange={handleFormChange}
                    onValidationChange={handleValidChange}
                    language={language}
                  />
                  
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-800 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Continue Button */}
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={handlePaymentSubmit}
                      disabled={!isFormValid || isLoading}
                      className="px-6 py-2 bg-[#856D55]/90 text-white rounded-lg hover:bg-[#856D55] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {isLoading 
                        ? (isHebrew ? 'יוצר תשלום...' : 'Creating payment...')
                        : (isHebrew ? 'המשך לתשלום' : 'Continue to Payment')
                      }
                    </button>
                  </div>
                </div>
              )}

              {step === 'CREATING_LP' && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#856D55] mx-auto mb-4"></div>
                    <p className="text-gray-600">
                      {isHebrew ? 'שומר פרטים ויוצר הפעלת תשלום...' : 'Saving details and creating payment session...'}
                    </p>
                  </div>
                </div>
              )}

              {step === 'PAYMENT' && redirectUrl && (
                <div className="flex-1 min-h-0">
                  <PaymentIframe
                    redirectUrl={redirectUrl}
                    orderId={createdOrderId || orderId}
                    lowProfileId={lowProfileId}
                    onPaymentComplete={handlePaymentComplete}
                    onError={handlePaymentError}
                    language={language}
                  />
                </div>
              )}
            </div>

            {/* Backdrop overlay - dims background when order summary is open */}
            {isOrderSummaryOpen && (
              <div 
                className="absolute inset-0 bg-black/20 z-10 transition-opacity"
                onClick={() => setIsOrderSummaryOpen(false)}
                aria-hidden="true"
              />
            )}

            {/* Order Summary Overlay - slides in from correct side */}
            <div
              className={`absolute top-0 bottom-0 w-80 bg-white border-gray-200 shadow-xl z-20 overflow-y-auto transition-transform duration-300 ease-in-out ${
                isRTL 
                  ? `right-0 ${isOrderSummaryOpen ? 'translate-x-0' : 'translate-x-full'} border-l` 
                  : `left-0 ${isOrderSummaryOpen ? 'translate-x-0' : '-translate-x-full'} border-r`
              }`}
            >
              <div className="p-6">
                <OrderSummary
                  items={items}
                  subtotal={subtotal || 0}
                  discountTotal={discountTotal || 0}
                  deliveryFee={deliveryFee || 0}
                  appliedCoupons={appliedCoupons}
                  language={language}
                  showPromoCode={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
