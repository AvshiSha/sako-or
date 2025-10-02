import { Resend } from 'resend';
import { OrderConfirmationEmail } from '../app/components/email-template';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface OrderEmailData {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  orderDate: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  isHebrew?: boolean;
}

export async function sendOrderConfirmationEmail(data: OrderEmailData) {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }

    const subject = data.isHebrew 
      ? `אישור הזמנה - ${data.orderNumber}`
      : `Order Confirmation - ${data.orderNumber}`;

    const { data: emailData, error } = await resend.emails.send({
      from: 'Sako Or <info@sako-or.com>',
      to: [data.customerEmail, 'moshe@sako-or.com', 'avshi@sako-or.com'],
      subject: subject,
      react: OrderConfirmationEmail({
        customerName: data.customerName,
        orderNumber: data.orderNumber,
        orderDate: data.orderDate,
        items: data.items,
        total: data.total,
        isHebrew: data.isHebrew,
      }),
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error };
    }

    console.log('Email sent successfully:', emailData);
    return { success: true, messageId: emailData?.id };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error };
  }
}
