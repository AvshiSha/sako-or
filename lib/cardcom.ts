import { CreateLowProfileRequest, CreateLowProfileResponse, LowProfileResult } from '../app/types/cardcom';

// CardCom API Configuration
const CARDCOM_BASE_URL = 'https://secure.cardcom.solutions';
const CARDCOM_API_VERSION = 'v11';

// Environment variables (add these to your .env.local)
const CARDCOM_TERMINAL_NUMBER = process.env.CARDCOM_TERMINAL_NUMBER;
const CARDCOM_API_NAME = process.env.CARDCOM_API_NAME;
const CARDCOM_API_PASSWORD = process.env.CARDCOM_API_PASSWORD; // For refunds
const CARDCOM_WEBHOOK_SECRET = process.env.CARDCOM_WEBHOOK_SECRET; // Optional webhook validation

export class CardComAPI {
  private baseUrl: string;
  private terminalNumber: number;
  private apiName: string;
  private apiPassword?: string;

  constructor() {
    if (!CARDCOM_TERMINAL_NUMBER || !CARDCOM_API_NAME) {
      throw new Error('Missing required CardCom environment variables: CARDCOM_TERMINAL_NUMBER, CARDCOM_API_NAME');
    }
    
    this.baseUrl = CARDCOM_BASE_URL;
    this.terminalNumber = parseInt(CARDCOM_TERMINAL_NUMBER);
    this.apiName = CARDCOM_API_NAME;
    this.apiPassword = CARDCOM_API_PASSWORD;
  }

  /**
   * Create a low profile payment session
   */
  async createLowProfile(request: CreateLowProfileRequest): Promise<CreateLowProfileResponse> {
    const url = `${this.baseUrl}/api/${CARDCOM_API_VERSION}/LowProfile/Create`;
    
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('CardCom API HTTP Error:', response.status, errorText);
      throw new Error(`CardCom API error: ${response.status} - ${errorText}`);
    }

    const result: CreateLowProfileResponse = await response.json();
    
    if (result.ResponseCode !== 0) {
      throw new Error(`CardCom API error: ${result.ResponseCode} - ${result.Description}`);
    }

    return result;
  }

  /**
   * Get low profile result (for polling)
   */
  async getLowProfileResult(lowProfileId: string): Promise<LowProfileResult> {
    const url = `${this.baseUrl}/api/${CARDCOM_API_VERSION}/LowProfile/GetLpResult`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        TerminalNumber: this.terminalNumber,
        ApiName: this.apiName,
        LowProfileId: lowProfileId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CardCom API error: ${response.status} - ${errorText}`);
    }

    const result: LowProfileResult = await response.json();
    return result;
  }

  /**
   * Validate webhook signature (if using webhook secret)
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    if (!CARDCOM_WEBHOOK_SECRET) {
      // If no secret is configured, skip validation
      return true;
    }

    // Implement webhook signature validation here
    // This depends on CardCom's signature method (HMAC, etc.)
    // For now, we'll skip validation
    return true;
  }

  /**
   * Get redirect URLs for the current domain
   */
  getRedirectUrls(baseUrl: string = "https://sako-or.com") {
    return {
      success: `${baseUrl}/Success`,
      failed: `${baseUrl}/Failed`,
      cancel: `${baseUrl}/Cancel`,
      webhook: `${baseUrl}/api/webhook/cardcom`,
    };
  }

  /**
   * Get Low Profile status
   */
  async getLowProfileStatus(lowProfileId: string): Promise<any> {
    return getLowProfileStatus(lowProfileId);
  }
}

// Note: CardComAPI should be instantiated at runtime, not at module level

// Helper function to create a payment session request
export function createPaymentSessionRequest(
  orderId: string,
  amount: number,
  currency: string = 'ILS',
  options: {
    customerEmail?: string;
    customerName?: string;
    customerPhone?: string;
    productName?: string;
    createToken?: boolean;
    language?: string;
    returnUrl?: string;
    // Document/Receipt options
    createDocument?: boolean;
    customerTaxId?: string;
    customerAddress?: string;
    customerAddress2?: string;
    customerCity?: string;
    customerMobile?: string;
    documentComments?: string;
    departmentId?: string;
    Products?: Array<{
      ProductID: string;
      Description: string;
      Quantity: number;
      UnitCost: number;
      TotalLineCost: number;
      IsVatFree: boolean;
    }>;
  } = {}
): CreateLowProfileRequest {
  // Generate redirect URLs without instantiating CardComAPI
  const baseUrl = "https://sako-or.com";
  const bypassSecret = process.env.RESEND_API_KEY;
  
  if (!bypassSecret) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  
  const redirectUrls = {
    success: `${baseUrl}/Success`,
    failure: `${baseUrl}/Failed`,
    cancel: `${baseUrl}/Cancel`,
    webhook: `${baseUrl}/api/webhook/cardcom?bypass=${bypassSecret}&lang=${options.language || 'he'}`,
  };

  const isILS = currency?.toUpperCase() === 'ILS' || currency === undefined || currency === null

  const request: CreateLowProfileRequest = {
    TerminalNumber: parseInt(CARDCOM_TERMINAL_NUMBER!),
    ApiName: CARDCOM_API_NAME!,
    Amount: amount,
    SuccessRedirectUrl: redirectUrls.success,
    FailedRedirectUrl: redirectUrls.failure,
    CancelRedirectUrl: redirectUrls.cancel,
    WebHookUrl: redirectUrls.webhook,
    ReturnValue: orderId,
    Operation: 'ChargeOnly', // Simplified - just charge, no tokens
    Language: options.language || 'he',
    ISOCoinId: 1, // Force ILS to avoid accidental USD charges
    ProductName: options.productName || 'Sako Order',
  };

  if (!isILS) {
    console.warn(
      `[CardCom] Unsupported currency "${currency}" requested for order ${orderId}. Defaulting to ILS (ISOCoinId=1).`
    );
  }

  // Add UI Definition for better UX
  if (options.customerEmail || options.customerName || options.customerPhone) {
    request.UIDefinition = {
      PrefillOwnerEmail: options.customerEmail,
      PrefillOwnerName: options.customerName,
      PrefillOwnerPhone: options.customerPhone,
    };
  }

  // Add Document/Receipt creation if requested
  if (options.createDocument && options.customerEmail && options.customerName) {
    request.Document = {
      DocumentTypeToCreate: "TaxInvoiceAndReceipt",
      Name: options.customerName,
      TaxId: options.customerTaxId || "",
      Email: options.customerEmail,
      IsSendByEmail: true,
      AddressLine1: options.customerAddress || "",
      AddressLine2: options.customerAddress2 || "",
      City: options.customerCity || "",
      Mobile: options.customerMobile || "",
      Phone: options.customerPhone || "",
      Comments: options.documentComments || "",
      IsVatFree: false,
      DepartmentId: options.departmentId || "", // You'll provide this value later
      Products: options.Products?.map(product => ({
        ProductID: product.ProductID,
        Description: product.Description,
        Quantity: product.Quantity,
        UnitCost: product.UnitCost,
        TotalLineCost: product.TotalLineCost,
        IsVatFree: false
      })) || [],
      IsAllowEditDocument: false,
      IsShowOnlyDocument: false,
      Language: options.language || 'he'
    };
  }

  return request;
}

/**
 * Get Low Profile status from CardCom
 */
export async function getLowProfileStatus(lowProfileId: string): Promise<any> {
  const CARDCOM_TERMINAL_NUMBER = process.env.CARDCOM_TERMINAL_NUMBER;
  const CARDCOM_API_NAME = process.env.CARDCOM_API_NAME;
  const CARDCOM_API_PASSWORD = process.env.CARDCOM_API_PASSWORD;

  if (!CARDCOM_TERMINAL_NUMBER || !CARDCOM_API_NAME || !CARDCOM_API_PASSWORD) {
    throw new Error('Missing required CardCom environment variables');
  }

  const requestBody = {
    TerminalNumber: parseInt(CARDCOM_TERMINAL_NUMBER),
    ApiName: CARDCOM_API_NAME,
    LowProfileId: lowProfileId,
  };

  const response = await fetch('https://secure.cardcom.solutions/api/v11/LowProfile/GetLowProfileStatus', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`CardCom API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  return result;
}
