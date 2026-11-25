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
  // Verifone invoice required fields
  FirstPaymentAmount?: number;
  ConstPaymentAmount?: number;
  NumberOfPayments?: number;
  Last4CardDigitsString?: string;
  CardMonth?: string;
  CardYear?: string;
  CardOwnerIdentityNumber?: string;
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

/**
 * UI Definition for customizing the hosted Low Profile page.
 *
 * Every name here is taken verbatim from CardCom's own v11 OpenAPI document
 * (https://secure.cardcom.solutions/swagger/v11/swagger.json). That matters
 * more than it looks: this interface previously described invented names -
 * `PrefillOwnerName`, `HideOwnerName`, `CustomCSS` and the rest - none of
 * which exist in the API. CardCom ignores keys it does not recognise, so the
 * prefill we believed we were sending silently did nothing, and shoppers
 * retyped a name, phone and email they had just given us at checkout. The
 * type checker could not catch it, because the type was the thing that was
 * wrong. Check the spec before adding a field here.
 */
export interface UIDefinition {
  /** "Hide card Owner name". Default false. There is NO IsCardOwnerNameRequired
   *  in v11 - the name can be hidden or pre-filled, but not left visible and
   *  optional. */
  IsHideCardOwnerName?: boolean;
  /** "Fill the value of CardOwnerName input box". Max 50 characters. */
  CardOwnerNameValue?: string;
  CardOwnerIdValue?: string;
  IsHideCardOwnerPhone?: boolean;
  /** Max 50 characters. */
  CardOwnerPhoneValue?: string;
  /** Defaults to TRUE at CardCom's end: left unset, the shopper must supply a
   *  phone. Pair it with CardOwnerPhoneValue rather than turning it off. */
  IsCardOwnerPhoneRequired?: boolean;
  /** Max 50 characters. */
  CardOwnerEmailValue?: string;
  IsHideCardOwnerEmail?: boolean;
  /** Also defaults to TRUE. Same reasoning as the phone. */
  IsCardOwnerEmailRequired?: boolean;
  IsHideCardOwnerIdentityNumber?: boolean;
  IsHideCVV?: boolean;
  /** Full URL of a stylesheet CardCom injects into the page. Max 250 chars.
   *  The spec notes it "required CardCom premition", so it probably has to be
   *  enabled on the account first - unverified, and nothing sends it today. */
  CSSUrl?: string;
  CustomFields?: CustomField[];
  /** Google Pay only. The v11 schemas carry no Apple Pay object: Apple Pay is
   *  configured on the terminal, not in this request. */
  GooglePayBtnDesign?: GooglePayBtnDesign;
}

/** NOT verified against the v11 spec - the schema exists there, but its fields
 *  were not read. Nothing sends CustomFields, so this is unexercised: confirm
 *  the real shape before relying on it, given what the names above turned out
 *  to be. */
export interface CustomField {
  FieldName: string;
  FieldValue?: string;
  IsRequired?: boolean;
  FieldType?: 'Text' | 'Number' | 'Email' | 'Phone';
}

/** v11 `GooglePayBtnDesign`. Widths and heights are strings in the spec, not
 *  numbers ("Default 328 (px)" / "Default 40 (px)"). Nothing sends this yet. */
export interface GooglePayBtnDesign {
  ButtonColor?: 'Default' | 'White' | 'Black';
  ButtonType?: 'Book' | 'Buy' | 'Checkout' | 'Donate' | 'Order' | 'Pay' | 'Plain' | 'Subscribe';
  ButtonLocale?: string;
  ButtonWidth?: string;
  ButtonHeight?: string;
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
