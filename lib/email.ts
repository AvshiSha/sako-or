import type { ReactElement } from 'react';
import { Resend } from 'resend';
import { OrderConfirmationEmail } from '../app/emails/order-confirmation';
import { OrderConfirmationEmailHebrew } from '../app/emails/order-confirmation-hebrew';
import { prisma } from './prisma';
import { OrderConfirmationTeamEmail } from '../app/emails/order-confirmation-team-mail';
import { EmailOtp } from '../app/emails/email-otp';
import { isValidEmailAddress } from './email-address';

let resendClient: Resend | null = null;
function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  if (!resendClient) {
    resendClient = new Resend(key);
  }
  return resendClient;
}

// In-memory cache for test orders (since they don't exist in database)
const testOrderEmailCache = new Map<string, { emailSentAt: Date; emailMessageId: string }>();

const FROM_ADDRESS = 'Sako Or <info@sako-or.com>';
const SHOP_EMAIL = 'info@sako-or.com';
const TEAM_EMAIL = 'moshe@sako-or.com';
const EMAIL_TIMEOUT_MS = 15000;

/** Which of the three order-confirmation emails a result belongs to. */
export type EmailRecipientLabel = 'customer' | 'shop' | 'team';

export interface EmailRecipientResult {
  label: EmailRecipientLabel;
  recipient: string;
  success: boolean;
  messageId?: string;
  /** Resend did not answer in time; the message may or may not have gone out. */
  timedOut?: boolean;
  error?: unknown;
}

/**
 * Outcome of an order-confirmation send attempt.
 *
 * `success` means at least one of the three emails went out; `customerSuccess`
 * is the one to check when what matters is whether the customer was told.
 */
export interface OrderEmailSendResult {
  success: boolean;
  messageId?: string;
  idempotencyKey?: string;
  /** Per-recipient outcomes, absent when the attempt failed before sending. */
  results?: EmailRecipientResult[];
  customerSuccess?: boolean;
  error?: unknown;
  /** Set when a previous send for this order was already recorded. */
  skipped?: boolean;
  reason?: string;
}

class EmailTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new EmailTimeoutError(`Resend API timeout (${label}) after ${EMAIL_TIMEOUT_MS}ms`)),
      EMAIL_TIMEOUT_MS
    );
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

/**
 * Send one order email to one recipient. Never throws and never rejects: every
 * outcome - an invalid address, a Resend validation error, a network exception,
 * a timeout - comes back as a resolved {@link EmailRecipientResult}.
 *
 * This isolation is the point. The customer, the shop and the team each get
 * their own message with their own recipient array and their own idempotency
 * key, so a bad customer address can no longer take the other two down with it.
 * Previously all three shared one Resend call (customer + shop) plus one call
 * gated behind its success (team), so a single 422 on the customer's address
 * meant nobody was told about the order at all.
 */
async function sendOrderEmailToRecipient(
  resend: Resend,
  params: {
    label: EmailRecipientLabel;
    recipient: string;
    orderNumber: string;
    subject: string;
    react: ReactElement;
    idempotencyKey: string;
  }
): Promise<EmailRecipientResult> {
  const { label, recipient, orderNumber, subject, react, idempotencyKey } = params;
  const base = { label, recipient } as const;

  // Reject locally rather than spending a round trip on an address Resend will
  // refuse anyway - and so the log names the address that is actually wrong.
  if (!isValidEmailAddress(recipient)) {
    const error = {
      name: 'validation_error',
      message: `Invalid recipient address for ${label}: "${recipient}"`,
      statusCode: 422,
    };
    console.error(
      `[EMAIL ${label.toUpperCase()} FAILED] Order ${orderNumber} - invalid address, not attempted:`,
      error
    );
    return { ...base, success: false, error };
  }

  try {
    const result = await withTimeout(
      resend.emails.send(
        { from: FROM_ADDRESS, to: [recipient], subject, react },
        { idempotencyKey }
      ),
      label
    );

    const { data: emailData, error } = result as { data?: any; error?: any };

    if (error) {
      console.error(
        `[EMAIL ${label.toUpperCase()} FAILED] Order ${orderNumber} to ${recipient}:`,
        error
      );
      return { ...base, success: false, error };
    }

    console.log(
      `[EMAIL ${label.toUpperCase()} SENT] Order ${orderNumber} to ${recipient}, messageId: ${emailData?.id}`
    );
    return { ...base, success: true, messageId: emailData?.id };
  } catch (err) {
    if (err instanceof EmailTimeoutError) {
      // Preserved from the previous implementation: a timeout is treated as
      // probably-sent rather than retried, to avoid double-sending.
      console.error(
        `[EMAIL ${label.toUpperCase()} TIMEOUT] Order ${orderNumber} to ${recipient} - assuming sent`
      );
      return { ...base, success: true, timedOut: true, messageId: `timeout-${Date.now()}` };
    }
    console.error(
      `[EMAIL ${label.toUpperCase()} FAILED] Order ${orderNumber} to ${recipient} threw:`,
      err
    );
    return { ...base, success: false, error: err };
  }
}

export interface OrderEmailData {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  orderDate: string;
  items: Array<{
    name: string;
    sku?: string;
    size?: string;
    colorName?: string;
    /** Optional primary product image URL (absolute preferred for email clients). */
    imageUrl?: string;
    /** Optional product page URL (absolute). */
    productUrl?: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  payer: {
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    idNumber: string;
  };
  deliveryAddress: {
    city: string;
    streetName: string;
    streetNumber: string;
    floor: string;
    apartmentNumber: string;
    zipCode: string;
  };
  notes?: string;
  isHebrew?: boolean;
  subtotal?: number;
  deliveryFee?: number;
  discountTotal?: number;
  coupons?: Array<{
    code: string;
    discountAmount: number;
    discountLabel?: string;
  }>;
  /**
   * Shipping method for this order: "delivery" or "pickup".
   * Used to control how delivery vs pickup details are rendered in the email.
   */
  shippingMethod?: 'delivery' | 'pickup';
  /**
   * Pickup location when shippingMethod === "pickup".
   */
  pickupLocation?: string;
  /**
   * Points the customer spent on this order (if any).
   */
  pointsSpent?: number;
}

export interface EmailOtpData {
  to: string;
  otpCode: string;
  userFirstname?: string;
  isHebrew?: boolean;
  brandName?: string;
}

export async function sendEmailOtp(data: EmailOtpData) {
  const resend = getResendClient();

  const subject = data.isHebrew ? 'קוד אימות - Sako Or' : 'Verification code - Sako Or';
  const idempotencyKey = `email-otp-${data.to}-${Date.now()}`;

  const text = data.isHebrew
    ? `קיבלנו בקשה להתחברות.\n\nקוד האימות שלך: ${data.otpCode}\n\nקוד זה תקף למשך 5 דקות.\n\nאם לא ביקשת להתחבר, אפשר להתעלם מהמייל הזה.`
    : `We received a request to sign in.\n\nYour verification code: ${data.otpCode}\n\nThis code expires in 5 minutes.\n\nIf you didn't request to sign in, you can ignore this email.`;

  const result = await resend.emails.send(
    {
      from: 'Sako Or <info@sako-or.com>',
      to: [data.to],
      subject,
      react: EmailOtp({
        userFirstname: data.userFirstname,
        otpCode: data.otpCode,
        isHebrew: data.isHebrew,
        brandName: data.brandName ?? 'Sako Or',
      }),
      text,
    },
    { idempotencyKey }
  );

  const { data: emailData, error } = result as { data?: any; error?: any };
  if (error) {
    throw error;
  }
  return { messageId: emailData?.id, idempotencyKey };
}

export async function sendOrderConfirmationEmail(
  data: OrderEmailData,
  orderId?: string
): Promise<OrderEmailSendResult> {
  try {
    const resend = getResendClient();

    // Production logging - minimal
    console.log(`[EMAIL] Sending confirmation for order ${data.orderNumber}`);

    const subject = data.isHebrew 
      ? `אישור הזמנה - ${data.orderNumber}`
      : `Order Confirmation - ${data.orderNumber}`;

    // Choose the appropriate email template based on language
    const EmailTemplate = data.isHebrew ? OrderConfirmationEmailHebrew : OrderConfirmationEmail;

    // Create idempotency key using order number and timestamp
    const idempotencyKey = `order-confirmation-${data.orderNumber}-${Date.now()}`;

    console.log(`[EMAIL SEND] Attempting to send confirmation email for order ${data.orderNumber}`, {
      orderId,
      customerEmail: data.customerEmail,
      idempotencyKey,
      timestamp: new Date().toISOString(),
      endpoint: 'sendOrderConfirmationEmail'
    });

    // The customer and the shop get the customer-facing confirmation; the team
    // gets the operations template. Built once, sent three times.
    const confirmationProps = {
      customerName: data.customerName,
      orderNumber: data.orderNumber,
      orderDate: data.orderDate,
      items: data.items,
      total: data.total,
      subtotal: data.subtotal,
      deliveryFee: data.deliveryFee,
      discountTotal: data.discountTotal,
      coupons: data.coupons,
      payer: data.payer,
      deliveryAddress: data.deliveryAddress,
      notes: data.notes,
      isHebrew: data.isHebrew,
      shippingMethod: data.shippingMethod,
      pickupLocation: data.pickupLocation,
      pointsSpent: data.pointsSpent,
    };

    // Three independent sends, started together and all awaited to completion.
    // Each helper resolves rather than throwing, and allSettled is the belt to
    // that braces: nothing any one recipient does can interrupt the other two.
    //
    // The keys must differ per recipient - Resend rejects a reused idempotency
    // key carrying a different payload. They keep the timestamp so a deliberate
    // resend (scripts/resend-order-email.ts) is not silently deduplicated.
    const settled = await Promise.allSettled([
      sendOrderEmailToRecipient(resend, {
        label: 'customer',
        recipient: data.customerEmail,
        orderNumber: data.orderNumber,
        subject,
        react: EmailTemplate(confirmationProps),
        idempotencyKey,
      }),
      sendOrderEmailToRecipient(resend, {
        label: 'shop',
        recipient: SHOP_EMAIL,
        orderNumber: data.orderNumber,
        subject,
        react: EmailTemplate(confirmationProps),
        idempotencyKey: `order-confirmation-shop-${data.orderNumber}-${Date.now()}`,
      }),
      sendOrderEmailToRecipient(resend, {
        label: 'team',
        recipient: TEAM_EMAIL,
        orderNumber: data.orderNumber,
        subject: `New Order Received - ${data.orderNumber}`,
        react: OrderConfirmationTeamEmail(confirmationProps),
        idempotencyKey: `order-confirmation-team-${data.orderNumber}-${Date.now()}`,
      }),
    ]);

    const labels: EmailRecipientLabel[] = ['customer', 'shop', 'team'];
    const recipients = [data.customerEmail, SHOP_EMAIL, TEAM_EMAIL];
    const results: EmailRecipientResult[] = settled.map((outcome, index) =>
      outcome.status === 'fulfilled'
        ? outcome.value
        : {
            label: labels[index],
            recipient: recipients[index],
            success: false,
            error: outcome.reason,
          }
    );

    const customerResult = results[0];
    const delivered = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(
      `[EMAIL] Order ${data.orderNumber} confirmation: ${delivered.length}/3 sent` +
        (failed.length ? ` - failed: ${failed.map((r) => r.label).join(', ')}` : '')
    );

    return {
      // Any delivered email counts as progress, so the order is marked processed
      // and a webhook retry cannot spray duplicates at the recipients that did
      // get through. A failed customer send is reported separately below, and
      // logged above as [EMAIL CUSTOMER FAILED].
      success: delivered.length > 0,
      messageId: customerResult.messageId ?? delivered[0]?.messageId,
      idempotencyKey,
      results,
      customerSuccess: customerResult.success,
      ...(customerResult.success ? {} : { error: customerResult.error }),
    };
  } catch (error) {
    console.error(`[EMAIL ERROR] Exception sending email for order ${data.orderNumber}:`, error);
    return { success: false, error: error };
  }
}

/**
 * Idempotent function to send order confirmation email
 * Checks if email was already sent before attempting to send
 */
export async function sendOrderConfirmationEmailIdempotent(
  data: OrderEmailData,
  orderId?: string
): Promise<OrderEmailSendResult> {
  try {
    // Check if email was already sent for this order
    if (orderId) {
      // First check in-memory cache for test orders
      const isTestOrder = orderId.startsWith('TEST-') || orderId.startsWith('ORDER-TEST-');
      
      if (isTestOrder) {
        const cachedEmail = testOrderEmailCache.get(orderId);
        if (cachedEmail) {
          console.log(`[EMAIL] Skipped - test order ${data.orderNumber} already processed`);
          return { 
            success: true, 
            messageId: cachedEmail.emailMessageId,
            skipped: true,
            reason: 'Test order email already sent'
          };
        }
      } else {
        // Check database for real orders
        const existingOrder = await prisma.order.findUnique({
          where: { orderNumber: orderId },
          select: { emailSentAt: true, emailMessageId: true }
        });

        if (existingOrder?.emailSentAt) {
          console.log(`[EMAIL] Skipped - order ${data.orderNumber} already processed`);
          return { 
            success: true, 
            messageId: existingOrder.emailMessageId ?? undefined,
            skipped: true,
            reason: 'Email already sent'
          };
        }
      }
    }

    // Send the email
    const result = await sendOrderConfirmationEmail(data, orderId);

    // Update order with email tracking if successful
    if (result.success && orderId) {
      const isTestOrder = orderId.startsWith('TEST-') || orderId.startsWith('ORDER-TEST-');
      
      if (isTestOrder) {
        // Cache test order email tracking in memory
        testOrderEmailCache.set(orderId, {
          emailSentAt: new Date(),
          emailMessageId: result.messageId || `test-${Date.now()}`
        });
        
        console.log(`[EMAIL] Test order ${orderId} cached for future duplicate prevention`);
      } else {
        // Update database for real orders
        try {
          await prisma.order.update({
            where: { orderNumber: orderId },
            data: {
              emailSentAt: new Date(),
              emailMessageId: result.messageId || null
            }
          });

          console.log(`[EMAIL] Order ${data.orderNumber} marked as processed`);
        } catch (dbError: any) {
          console.error(`[EMAIL TRACKING ERROR] Failed to update order ${orderId}:`, dbError);
        }
      }
    }

    return result;
  } catch (error) {
    console.error(`[EMAIL IDEMPOTENT ERROR] Failed to send idempotent email for order ${data.orderNumber}:`, error);
    return { success: false, error: error };
  }
}
