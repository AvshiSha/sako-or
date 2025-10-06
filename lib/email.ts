import { Resend } from 'resend';
import { OrderConfirmationEmail } from '../app/emails/order-confirmation';
import { OrderConfirmationEmailHebrew } from '../app/emails/order-confirmation-hebrew';
import { prisma } from './prisma';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface OrderEmailData {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  orderDate: string;
  items: Array<{
    name: string;
    sku?: string;
    size?: string;
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
}

export async function sendOrderConfirmationEmail(data: OrderEmailData, orderId?: string) {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }

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

    const { data: emailData, error } = await resend.emails.send({
      from: 'Sako Or <info@sako-or.com>',
      to: [data.customerEmail, 'moshe@sako-or.com', 'avshi@sako-or.com'],
      subject: subject,
      react: EmailTemplate({
        customerName: data.customerName,
        orderNumber: data.orderNumber,
        orderDate: data.orderDate,
        items: data.items,
        total: data.total,
        payer: data.payer,
        deliveryAddress: data.deliveryAddress,
        notes: data.notes,
        isHebrew: data.isHebrew,
      }),
      // Add idempotency key to prevent duplicate sends
      headers: {
        'Idempotency-Key': idempotencyKey
      }
    });

    if (error) {
      console.error(`[EMAIL ERROR] Failed to send email for order ${data.orderNumber}:`, error);
      return { success: false, error: error };
    }

    console.log(`[EMAIL SUCCESS] Email sent successfully for order ${data.orderNumber}:`, {
      messageId: emailData?.id,
      idempotencyKey,
      timestamp: new Date().toISOString()
    });

    return { success: true, messageId: emailData?.id, idempotencyKey };
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
    console.log(`[EMAIL IDEMPOTENT] Checking if email already sent for order ${data.orderNumber}`, {
      orderId,
      timestamp: new Date().toISOString()
    });

    // Check if email was already sent for this order
    if (orderId) {
      const existingOrder = await prisma.order.findUnique({
        where: { orderNumber: orderId },
        select: { emailSentAt: true, emailMessageId: true }
      });

      if (existingOrder?.emailSentAt) {
        console.log(`[EMAIL SKIP] Email already sent for order ${data.orderNumber} at ${existingOrder.emailSentAt}`, {
          messageId: existingOrder.emailMessageId,
          timestamp: new Date().toISOString()
        });
        return { 
          success: true, 
          messageId: existingOrder.emailMessageId,
          skipped: true,
          reason: 'Email already sent'
        };
      }
    }

    // Send the email
    const result = await sendOrderConfirmationEmail(data, orderId);

    // Update order with email tracking if successful
    if (result.success && orderId) {
      await prisma.order.update({
        where: { orderNumber: orderId },
        data: {
          emailSentAt: new Date(),
          emailMessageId: result.messageId || null
        }
      });

      console.log(`[EMAIL TRACKING] Updated order ${data.orderNumber} with email tracking`, {
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      });
    }

    return result;
  } catch (error) {
    console.error(`[EMAIL IDEMPOTENT ERROR] Failed to send idempotent email for order ${data.orderNumber}:`, error);
    return { success: false, error: error };
  }
}
