// Checkout Modal Types

export type CheckoutStep = 'IDLE' | 'DETAILS' | 'CREATING_LP' | 'PAYING' | 'RESULT';

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'cancelled';

export interface PayerDetails {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  idNumber?: string;
}

export interface DeliveryAddress {
  city: string;
  streetName: string;
  streetNumber: string;
  floor?: string;
  apartmentNumber?: string;
  zipCode?: string;
}

export interface InvoiceDetails {
  invoiceTo: string;
  city: string;
  addressLine1: string;
  mobile: string;
  email: string;
}

export interface CheckoutFormData {
  payer: PayerDetails;
  deliveryAddress: DeliveryAddress;
  notes?: string;
}

export interface CreateLowProfileRequest {
  orderId: string;
  amount: number;
  currencyIso: number; // 1=ILS, 2=USD
  language: string;
  productName: string; // Legacy - for single product
  productSku: string; // Legacy - for single product
  quantity: number; // Legacy - for single product
  items?: Array<{ // New - for multiple cart items
    productName: string;
    productSku: string;
    quantity: number;
    price: number; // Price per unit
    color?: string;
    size?: string;
  }>;
  customer: PayerDetails;
  deliveryAddress: DeliveryAddress;
  notes?: string;
  ui?: {
    isCardOwnerPhoneRequired: boolean;
    cssUrl?: string;
  };
  advanced?: {
    jValidateType: number;
    threeDSecureState: string;
    minNumOfPayments: number;
    maxNumOfPayments: number;
  };
}

export interface CreateLowProfileResponse {
  success: boolean;
  lowProfileId: string;
  paymentUrl: string; // Changed from redirectUrl to paymentUrl to match API
  orderId: string;
  orderDbId: string;
  amount: number;
  currency: string;
  error?: string;
}

export interface PaymentStatusResponse {
  status: PaymentStatus;
  order: {
    id: string;
    orderNumber: string;
    total: number;
    currency: string;
    status: string;
    paymentStatus: string;
    createdAt: string;
    orderItems: Array<{
      productName: string;
      quantity: number;
      price: number;
      total: number;
    }>;
  };
  transaction?: {
    id: string;
    amount: number;
    currency: string;
    last4Digits: string;
    cardBrand: string;
    status: string;
  };
  documentUrl?: string;
}

export interface PaymentResult {
  status: PaymentStatus;
  lpid: string;
  orderId?: string;
  message?: string;
}

// PostMessage types for iframe communication
export interface PaymentRedirectMessage {
  type: 'CARD_PAYMENT_REDIRECT';
  status: 'success' | 'failed' | 'cancelled';
  lpid: string;
  orderId?: string;
}

// Modal state
export interface CheckoutModalState {
  step: CheckoutStep;
  formData: CheckoutFormData;
  paymentResult?: PaymentResult;
  error?: string;
  isLoading: boolean;
}

// Validation errors
export interface ValidationErrors {
  name?: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  invoiceTo?: string;
  city?: string;
  addressLine1?: string;
  mobile?: string;
  invoiceEmail?: string;
}
