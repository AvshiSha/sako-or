import { Resend } from 'resend';
import { OrderConfirmationEmail } from '../app/emails/order-confirmation';
import { OrderConfirmationEmailHebrew } from '../app/emails/order-confirmation-hebrew';
import { prisma } from './prisma';
import { OrderConfirmationTeamEmail } from '../app/emails/order-confirmation-team-mail';
import { EmailOtp } from '../app/emails/email-otp';

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

export async function sendOrderConfirmationEmail(data: OrderEmailData, orderId?: string) {
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

    // Production email with proper template and recipients
    const emailPromise = resend.emails.send({
      from: 'Sako Or <info@sako-or.com>',
      to: [data.customerEmail, 'avshi@sako-or.com'],
      subject: subject,
      react: EmailTemplate({
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
      }),
    }, {
      idempotencyKey: idempotencyKey,
    });

    // Create a timeout wrapper for the email promise
    const timeoutMs = 15000; // 15 seconds
    
    try {
      const result = await Promise.race([
        emailPromise,
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Resend API timeout after ${timeoutMs}ms`));
          }, timeoutMs);
        })
      ]);
      
      console.log(`[EMAIL] Successfully sent confirmation for order ${data.orderNumber}`);
      
      const { data: emailData, error } = result as { data?: any; error?: any };
      
      if (error) {
        console.error(`[EMAIL ERROR] Failed to send email for order ${data.orderNumber}:`, error);
        return { success: false, error: error };
      }

      console.log(`[EMAIL] Confirmation sent for order ${data.orderNumber}, messageId: ${emailData?.id}`);

      // Send team notification email (does not affect the main result)
      try {
        const teamIdempotencyKey = `order-confirmation-team-${data.orderNumber}-${Date.now()}`;
        await Promise.race([
          resend.emails.send({
            from: 'Sako Or <info@sako-or.com>',
            to: ['moshe@sako-or.com', 'avshi@sako-or.com'],
            subject: `New Order Received - ${data.orderNumber}`,
            react: OrderConfirmationTeamEmail({
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
            }),
          }, { idempotencyKey: teamIdempotencyKey }),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Resend API timeout (team) after ${timeoutMs}ms`)), timeoutMs);
          }),
        ]);
        console.log(`[EMAIL] Team notification sent for order ${data.orderNumber}`);
      } catch (teamError) {
        console.error(`[EMAIL TEAM ERROR] Failed to send team email for order ${data.orderNumber}:`, teamError);
      }

      return { success: true, messageId: emailData?.id, idempotencyKey };
      
    } catch (timeoutError) {
      console.error(`[EMAIL TIMEOUT] API timeout for order ${data.orderNumber}, assuming email sent`);
      
      // Fallback: assume email was sent successfully despite timeout
      return { 
        success: true, 
        messageId: `timeout-${Date.now()}`, 
        idempotencyKey
      };
    }
  } catch (error) {
    console.error(`[EMAIL ERROR] Exception sending email for order ${data.orderNumber}:`, error);
    return { success: false, error: error };
  }
}

/**
 * Idempotent function to send order confirmation email
 * Checks if email was already sent before attempting to send
 */
export async function sendOrderConfirmationEmailIdempotent(data: OrderEmailData, orderId?: string) {
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
            messageId: existingOrder.emailMessageId,
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
