'use client';

import { useState, useEffect } from 'react';
import { CheckoutStep, CheckoutFormData, CreateLowProfileRequest, CreateLowProfileResponse, PaymentResult } from '../types/checkout';
import PayerDetailsForm from './PayerDetailsForm';
import PaymentIframe from './PaymentIframe';
import PaymentResultComponent from './PaymentResult';
import { trackBeginCheckout } from '@/lib/dataLayer';
import { CartItem } from '../hooks/useCart';

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
  items?: CartItem[]; // Cart items for tracking
  appliedCoupons?: Array<{
    code: string;
    discountAmount: number;
    discountType: 'percent_all' | 'percent_specific' | 'fixed' | 'bogo';
    stackable: boolean;
    description?: string;
  }>;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  orderId,
  amount,
  subtotal,
  discountTotal,
  deliveryFee,
  currency = 'ILS',
  productName = 'Sako Order',
  productSku = 'UNKNOWN',
  quantity = 1,
  language = 'he',
  items = [],
  appliedCoupons = []
}: CheckoutModalProps) {
  const [step, setStep] = useState<CheckoutStep>('IDLE');
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
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string>('');
  const [lowProfileId, setLowProfileId] = useState<string>('');
  const [createdOrderId, setCreatedOrderId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isHebrew = language === 'he';

  // Reset modal when opened
  useEffect(() => {
    if (isOpen) {
      setStep('DETAILS');
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
      setPaymentResult(null);
      setRedirectUrl('');
      setLowProfileId('');
      setCreatedOrderId('');
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

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
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save checkout information');
      } catch (error) {
        if (error instanceof Error && error.message !== 'Failed to save checkout information') {
          throw new Error('Failed to save checkout information');
        }
        throw error;
      }
    }

    try {
      const result = await response.json();
      return result.checkoutId;
    } catch (error) {
      console.error('Failed to parse checkout response:', error);
      throw new Error('Invalid response from server');
    }
  };

  // Create Low Profile payment session
  const createPaymentSession = async (): Promise<CreateLowProfileResponse> => {
    // Prepare items array from cart items if available
    const orderItems = items && items.length > 0
      ? items.map(item => ({
          productName: item.name[language as 'en' | 'he'] || productName,
          productSku: item.sku,
          quantity: item.quantity,
          price: item.salePrice || item.price, // Price per unit
          color: item.color,
          size: item.size,
        }))
      : undefined;

    const payload: CreateLowProfileRequest = {
      orderId,
      amount,
      currencyIso: currency === 'USD' ? 2 : 1, // 1=ILS, 2=USD
      language: isHebrew ? 'he' : 'en',
      productName, // Legacy fallback
      productSku, // Legacy fallback
      quantity, // Legacy fallback
      items: orderItems, // New - send all cart items
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
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment session');
      } catch (error) {
        if (error instanceof Error && error.message !== 'Failed to create payment session') {
          throw new Error('Failed to create payment session');
        }
        throw error;
      }
    }

    try {
      return await response.json();
    } catch (error) {
      console.error('Failed to parse payment response:', error);
      throw new Error('Invalid response from server');
    }
  };

  // Handle payment submission
  const handlePaymentSubmit = async () => {
    if (!isFormValid) return;

    // Track begin_checkout event
    try {
      if (items.length > 0) {
        const checkoutItems = items.map(item => ({
          name: item.name[language as 'en' | 'he'] || 'Unknown Product',
          id: item.sku,
          price: item.salePrice || item.price,
          brand: undefined, // Cart items don't have brand info
          categories: undefined, // Cart items don't have category info
          variant: [item.size, item.color].filter(Boolean).join('-') || undefined,
          quantity: item.quantity
        }));
        
        trackBeginCheckout(checkoutItems, currency);
      }
    } catch (dataLayerError) {
      console.warn('Data layer tracking error:', dataLayerError);
    }

    setStep('CREATING_LP');
    setIsLoading(true);
    setError(null);

    try {
      // First save checkout information to database
      console.log('Saving checkout information...');
      const checkoutId = await saveCheckoutInfo();
      console.log('Checkout saved with ID:', checkoutId);
      
      // Then create payment session
      console.log('Creating payment session...');
      const result = await createPaymentSession();
      
      if (result.success) {
        setRedirectUrl(result.paymentUrl);
        setLowProfileId(result.lowProfileId || '');
        setCreatedOrderId(result.orderId || orderId);
        setStep('PAYING');
        setIsLoading(false);
      } else {
        throw new Error(result.error || 'Failed to create payment session');
      }
    } catch (err) {
      console.error('Payment creation error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setStep('DETAILS');
      setIsLoading(false);
    }
  };

  // Handle payment completion
  const handlePaymentComplete = (result: { status: 'success' | 'failed' | 'cancelled'; lpid: string; orderId?: string }) => {
    setPaymentResult({
      status: result.status,
      lpid: result.lpid,
      orderId: result.orderId
    });
    setStep('RESULT');
  };

  // Handle payment error
  const handlePaymentError = (error: string) => {
    setError(error);
    setStep('DETAILS');
  };

  // Handle retry
  const handleRetry = () => {
    setStep('DETAILS');
    setError(null);
    setPaymentResult(null);
  };

  // Handle modal close
  const handleClose = () => {
    if (step === 'PAYING') {
      // Don't allow closing during payment
      return;
    }
    onClose();
  };

  // Handle cancel during payment
  const handleCancelPayment = () => {
    setStep('DETAILS');
    setRedirectUrl('');
    setLowProfileId('');
    setCreatedOrderId('');
    setError(null);
    setPaymentResult(null);
    setIsLoading(false);
    // Reset form data to ensure clean state
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
  };

  // Handle ESC key and body scroll lock
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && step !== 'PAYING') {
        handleClose();
      }
    };

    if (isOpen) {
      // Lock body scroll
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEsc);
      
      return () => {
        // Restore body scroll
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEsc);
      };
    }
  }, [isOpen, step]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 bg-opacity-50 transition-opacity" onClick={handleClose} />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-xl font-semibold text-gray-900">
              {isHebrew ? 'המשך לתשלום' : 'Proceed to Checkout'}
            </h2>
            {step !== 'PAYING' && (
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="sr-only">{isHebrew ? 'סגור' : 'Close'}</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Content - Scrollable area */}
          <div className="flex-1 overflow-y-auto p-6">
            {step === 'DETAILS' && (
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
              </div>
            )}

            {step === 'CREATING_LP' && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">
                    {isHebrew ? 'שומר פרטים ויוצר הפעלת תשלום...' : 'Saving details and creating payment session...'}
                  </p>
                </div>
              </div>
            )}

            {step === 'PAYING' && redirectUrl && (
              <PaymentIframe
                redirectUrl={redirectUrl}
                orderId={createdOrderId || orderId}
                lowProfileId={lowProfileId}
                onPaymentComplete={handlePaymentComplete}
                onError={handlePaymentError}
                language={language}
              />
            )}

            {step === 'RESULT' && paymentResult && (
              <PaymentResultComponent
                lpid={paymentResult.lpid}
                orderId={paymentResult.orderId}
                initialStatus={paymentResult.status}
                onRetry={handleRetry}
                language={language}
              />
            )}
          </div>

          {/* Footer - Sticky */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50">
            {step === 'DETAILS' && (
              <div className="flex items-center justify-end space-x-3 p-6">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {isHebrew ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  onClick={handlePaymentSubmit}
                  disabled={!isFormValid || isLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isLoading 
                    ? (isHebrew ? 'יוצר תשלום...' : 'Creating payment...')
                    : (isHebrew ? 'שלם עכשיו' : 'Pay Now')
                  }
                </button>
              </div>
            )}

            {step === 'PAYING' && (
              <div className="flex items-center justify-between p-6">
                <button
                  onClick={handleCancelPayment}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {isHebrew ? 'ביטול' : 'Cancel'}
                </button>
                <div className="flex-1 text-center text-sm text-gray-600">
                  <p className="font-medium">
                    {isHebrew ? 'תשלום מאובטח' : 'Secure Payment'}
                  </p>
                  <p>
                    {isHebrew 
                      ? 'אל תסגור את החלון עד לסיום התשלום'
                      : 'Do not close this window until payment is complete'
                    }
                  </p>
                </div>
              </div>
            )}

            {step === 'RESULT' && (
              <div className="flex items-center justify-center p-6">
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  {isHebrew ? 'סגור' : 'Close'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
