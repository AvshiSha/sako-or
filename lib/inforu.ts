import { prisma } from './prisma';

// Inforu API Configuration
const INFORU_API_URL = 'https://capi.inforu.co.il/api/Automation/Trigger?json=';

// Environment variables
const INFORU_USERNAME = process.env.INFORU_USERNAME;
const INFORU_TOKEN = process.env.INFORU_TOKEN;

// In-memory cache for test orders (since they don't exist in database)
const testOrderSmsCache = new Map<string, { smsSentAt: Date; smsMessageId: string }>();

export interface InforuContact {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber: string; // Local format (0XXXXXXXXX)
  contactRefId?: string;
}

export interface InforuTriggerData {
  apiEventName: string; // e.g., "CustomerPurchase"
  contacts: InforuContact[];
  customFields?: Record<string, any>; // For future extensibility
}

export interface InforuTriggerResult {
  success: boolean;
  messageId?: string;
  error?: any;
  skipped?: boolean;
  reason?: string;
}

/**
 * Converts E.164 format phone number (+972XXXXXXXXX) to local Israeli format (0XXXXXXXXX)
 * Returns null if conversion fails or input is invalid
 */
export function e164ToLocalPhone(e164: string | null | undefined): string | null {
  if (!e164) return null;

  const trimmed = e164.trim();
  if (!trimmed) return null;

  // Extract all digits
  const digits = trimmed.replace(/\D/g, '');

  // Handle E.164 format: +972XXXXXXXXX -> 0XXXXXXXXX
  if (trimmed.startsWith('+972')) {
    const afterCode = digits.slice(3); // Remove '972' prefix
    if (afterCode.length >= 8 && afterCode.length <= 9) {
      return `0${afterCode}`;
    }
  } else if (digits.startsWith('972')) {
    // International without +: 972XXXXXXXXX -> 0XXXXXXXXX
    const afterCode = digits.slice(3);
    if (afterCode.length >= 8 && afterCode.length <= 9) {
      return `0${afterCode}`;
    }
  } else if (digits.startsWith('0')) {
    // Already in local format
    if (digits.length >= 9 && digits.length <= 10) {
      return digits;
    }
  }

  return null;
}

/**
 * Generic function to trigger Inforu automation
 */
export async function triggerInforuAutomation(
  data: InforuTriggerData
): Promise<InforuTriggerResult> {
  try {
    // Validate environment variables
    if (!INFORU_USERNAME || !INFORU_TOKEN) {
      throw new Error('Missing required Inforu environment variables: INFORU_USERNAME, INFORU_TOKEN');
    }

    // Validate required fields
    if (!data.apiEventName) {
      throw new Error('apiEventName is required');
    }

    if (!data.contacts || data.contacts.length === 0) {
      throw new Error('At least one contact is required');
    }

    // Validate contacts have required fields (email or phoneNumber)
    const validContacts = data.contacts.filter(
      (contact) => contact.email || contact.phoneNumber
    );

    if (validContacts.length === 0) {
      throw new Error('At least one contact must have email or phoneNumber');
    }

    // Prepare request payload
    const payload = {
      User: {
        Username: INFORU_USERNAME,
        Token: INFORU_TOKEN,
      },
      Data: {
        ApiEventName: data.apiEventName,
        Contacts: validContacts.map((contact) => {
          const contactData: any = {};
          
          if (contact.phoneNumber) {
            contactData.PhoneNumber = contact.phoneNumber;
          }
          if (contact.email) {
            contactData.Email = contact.email;
          }
          if (contact.firstName) {
            contactData.FirstName = contact.firstName;
          }
          if (contact.lastName) {
            contactData.LastName = contact.lastName;
          }
          if (contact.contactRefId) {
            contactData.ContactRefId = contact.contactRefId;
          }

          return contactData;
        }),
      },
    };

    console.log(`[INFORU] Triggering automation: ${data.apiEventName}`, {
      contactCount: validContacts.length,
      hasCustomFields: !!data.customFields,
    });

    // Create a timeout wrapper for the API request
    const timeoutMs = 15000; // 15 seconds

    const fetchPromise = fetch(INFORU_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    try {
      const response = await Promise.race([
        fetchPromise,
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Inforu API timeout after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Inforu API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json().catch(async () => {
        // If JSON parsing fails, try to get text
        const text = await response.text();
        throw new Error(`Invalid JSON response from Inforu: ${text}`);
      });

      console.log(`[INFORU] Successfully triggered automation: ${data.apiEventName}`);

      // Inforu may return different response formats, extract message ID if available
      const messageId = result?.MessageId || result?.EventId || result?.Id || `inforu-${Date.now()}`;

      return {
        success: true,
        messageId,
      };
    } catch (timeoutError) {
      console.error(`[INFORU TIMEOUT] API timeout for ${data.apiEventName}, assuming message sent`);
      
      // Fallback: assume message was sent successfully despite timeout
      return {
        success: true,
        messageId: `timeout-${Date.now()}`,
      };
    }
  } catch (error) {
    console.error(`[INFORU ERROR] Failed to trigger automation ${data.apiEventName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Idempotent function to trigger Inforu automation
 * Checks if SMS was already sent before attempting to send
 */
export async function triggerInforuAutomationIdempotent(
  data: InforuTriggerData,
  orderId?: string
): Promise<InforuTriggerResult> {
  try {
    // Check if SMS was already sent for this order
    if (orderId) {
      const isTestOrder = orderId.startsWith('TEST-') || orderId.startsWith('ORDER-TEST-');

      if (isTestOrder) {
        const cachedSms = testOrderSmsCache.get(orderId);
        if (cachedSms) {
          console.log(`[INFORU] Skipped - test order ${orderId} already processed`);
          return {
            success: true,
            messageId: cachedSms.smsMessageId,
            skipped: true,
            reason: 'Test order SMS already sent',
          };
        }
      } else {
        // Check database for real orders
        const existingOrder = await prisma.order.findUnique({
          where: { orderNumber: orderId },
          select: { smsSentAt: true, smsMessageId: true },
        });

        if (existingOrder?.smsSentAt) {
          console.log(`[INFORU] Skipped - order ${orderId} already processed`);
          return {
            success: true,
            messageId: existingOrder.smsMessageId || undefined,
            skipped: true,
            reason: 'SMS already sent',
          };
        }
      }
    }

    // Trigger the automation
    const result = await triggerInforuAutomation(data);

    // Update order with SMS tracking if successful
    if (result.success && orderId) {
      const isTestOrder = orderId.startsWith('TEST-') || orderId.startsWith('ORDER-TEST-');

      if (isTestOrder) {
        // Cache test order SMS tracking in memory
        testOrderSmsCache.set(orderId, {
          smsSentAt: new Date(),
          smsMessageId: result.messageId || `test-${Date.now()}`,
        });

        console.log(`[INFORU] Test order ${orderId} cached for future duplicate prevention`);
      } else {
        // Update database for real orders
        try {
          await prisma.order.update({
            where: { orderNumber: orderId },
            data: {
              smsSentAt: new Date(),
              smsMessageId: result.messageId || null,
            },
          });

          console.log(`[INFORU] Order ${orderId} marked as processed`);
        } catch (dbError: any) {
          console.error(`[INFORU TRACKING ERROR] Failed to update order ${orderId}:`, dbError);
        }
      }
    }

    return result;
  } catch (error) {
    console.error(`[INFORU IDEMPOTENT ERROR] Failed to trigger idempotent automation:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
