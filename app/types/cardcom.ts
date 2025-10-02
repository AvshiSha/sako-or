// CardCom API Types based on OpenAPI 3.0 spec

export interface CreateLowProfileRequest {
  TerminalNumber: number;
  ApiName: string;
  Amount: number;
  SuccessRedirectUrl: string;
  FailedRedirectUrl: string;
  WebHookUrl: string;
  Operation?: 'ChargeOnly' | 'ChargeAndCreateToken' | 'CreateTokenOnly' | 'SuspendedDeal' | 'Do3DSAndSubmit';
  ReturnValue?: string; // Your order ID (max 250 chars)
  CancelRedirectUrl?: string;
  ProductName?: string; // Text to show if no document (max 250 chars)
  Language?: string; // he, en, ru, sp (default: he)
  ISOCoinId?: number; // 1=ILS, 2=USD (default: 1)
  UIDefinition?: UIDefinition;
  AdvancedDefinition?: AdvancedLPDefinition;
  Document?: Document;
  DocumentDefinition?: DocumentDefinition;
}

export interface CreateLowProfileResponse {
  ResponseCode: number; // 0 = success
  Description?: string;
  LowProfileId?: string; // Save this!
  Url?: string; // Redirect cardholder here
  UrlToPayPal?: string;
  UrlToBit?: string;
}

export interface LowProfileResult {
  ResponseCode: number; // 0 = success
  Description?: string;
  TerminalNumber: number;
  LowProfileId: string;
  TranzactionId?: number;
  ReturnValue?: string; // Your order ID
  Operation?: string;
  UIValues?: LowProfileUIValues;
  DocumentInfo?: DocumentInfo;
  TokenInfo?: TokenInfo;
  SuspendedInfo?: SuspendedInfo;
  TranzactionInfo?: TransactionInfo;
  ExternalPaymentVector?: string;
  Country?: string;
  UTM?: UTMData;
}

export interface LowProfileUIValues {
  Email?: string;
  Name?: string;
  Phone?: string;
  ID?: string;
  Payments?: number;
  CardExpiry?: string;
  CustomFields?: Record<string, string>;
  IsAbroad?: boolean;
}

export interface TokenInfo {
  Token: string; // GUID
  CardMonth?: string;
  CardYear?: string;
  TokenExDate?: string;
  TokenApprovalNumber?: string;
  CardLast4Digits?: string;
  CardBrand?: string;
}

export interface TransactionInfo {
  Amount?: number;
  Currency?: string;
  Last4Digits?: string;
  ApprovalNumber?: string;
  Brand?: string;
  RRN?: string;
  AuthCode?: string;
}

export interface DocumentInfo {
  DocumentId?: string;
  DocumentUrl?: string;
  DocumentType?: string;
}

export interface SuspendedInfo {
  SuspendedDealId?: string;
  SuspendedDealUrl?: string;
}

export interface UTMData {
  Source?: string;
  Medium?: string;
  Campaign?: string;
  Term?: string;
  Content?: string;
}

// UI Definition for customizing the payment page
export interface UIDefinition {
  HideOwnerName?: boolean;
  HideOwnerPhone?: boolean;
  HideOwnerEmail?: boolean;
  HideOwnerID?: boolean;
  HideCVV?: boolean;
  PrefillOwnerName?: string;
  PrefillOwnerPhone?: string;
  PrefillOwnerEmail?: string;
  PrefillOwnerID?: string;
  CustomCSS?: string;
  CustomFields?: CustomField[];
  GooglePayButton?: GooglePayButton;
}

export interface CustomField {
  FieldName: string;
  FieldValue?: string;
  IsRequired?: boolean;
  FieldType?: 'Text' | 'Number' | 'Email' | 'Phone';
}

export interface GooglePayButton {
  Color?: 'default' | 'black' | 'white';
  Type?: 'long' | 'short';
  Locale?: string;
  Size?: 'small' | 'medium' | 'large';
}

// Advanced Definition for payment options
export interface AdvancedLPDefinition {
  VirtualTerminal?: boolean;
  JValidationType?: 'J2' | 'J5';
  AVS?: boolean;
  RefundFlag?: boolean;
  CoinByName?: string;
  MinPayments?: number;
  MaxPayments?: number;
  SelectedPayments?: number;
  PreSeedCardNumber?: string;
  PreSeedCardExpiry?: string;
  PreSeedCVV?: string;
  ThreeDSecureState?: 'On' | 'Off' | 'IfSupported';
  PinpadOnLoad?: boolean;
  ExternalPageFlag?: boolean;
}

// Document for invoice/receipt generation (CardCom format)
export interface Document {
  DocumentTypeToCreate: 'TaxInvoiceAndReceipt' | 'Receipt' | 'Order' | 'Invoice';
  Name: string;
  TaxId?: string;
  Email: string;
  IsSendByEmail?: boolean;
  AddressLine1?: string;
  AddressLine2?: string;
  City?: string;
  Mobile?: string;
  Phone?: string;
  Comments?: string;
  IsVatFree?: boolean;
  DepartmentId?: string;
  Products: CardComProduct[];
  IsAllowEditDocument?: boolean;
  IsShowOnlyDocument?: boolean;
  Language?: string;
}

export interface CustomerDetails {
  Name?: string;
  Email?: string;
  Phone?: string;
  ID?: string;
  Address?: string;
  City?: string;
  ZipCode?: string;
  Country?: string;
}

export interface Product {
  ProductName: string;
  Quantity: number;
  Price: number;
  VAT?: number;
  Discount?: number;
}

// CardCom specific product format for documents
export interface CardComProduct {
  ProductID: string;
  Description: string;
  Quantity: number;
  UnitCost: number;
  TotalLineCost: number;
  IsVatFree: boolean;
}

// Error response
export interface CardComError {
  ResponseCode: number;
  Description: string;
}

// Payment flow types
export interface PaymentSession {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  cardcomLowProfileId?: string;
  cardcomTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
}

export interface CreatePaymentRequest {
  orderId?: string; // Optional - will be generated if not provided
  amount: number;
  currency?: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  productName?: string;
  returnUrl?: string; // Optional custom return URL
  createToken?: boolean; // Whether to create a token for future payments
  createDocument?: boolean; // Whether to create an invoice/receipt
  items?: {
    productName: string;
    productSku: string;
    colorName?: string;
    size?: string;
    quantity: number;
    price: number;
  }[];
}

// Document Definition for receipt/invoice creation
export interface DocumentDefinition {
  TypeToCreate: "TaxInvoiceAndReceipt" | "Receipt" | "Order" | "Invoice";
  Name: string;
  TaxId?: string;
  Email: string;
  IsSendByEmail: boolean;
  AddressLine1?: string;
  AddressLine2?: string;
  City?: string;
  Mobile?: string;
  Phone?: string;
  Comments?: string;
  IsVatFree: boolean;
  DepartmentId?: string;
  Products: DocumentProduct[];
  IsAllowEditDocument: boolean;
  IsShowOnlyDocument: boolean;
  Language: string;
}

export interface DocumentProduct {
  ProductID: string;
  Description: string;
  Quantity: number;
  UnitCost: number;
  TotalLineCost: number;
  IsVatFree: boolean;
}
