import sgMail from '@sendgrid/mail';

// Set the API key - try multiple ways to load it
const apiKey = process.env.SENDGRID_API_KEY || 
               process.env.NEXT_PUBLIC_SENDGRID_API_KEY;

if (!apiKey) {
  throw new Error('SENDGRID_API_KEY environment variable is not set');
}
if (!apiKey.startsWith('SG.')) {
  throw new Error('SENDGRID_API_KEY must start with "SG."');
}
sgMail.setApiKey(apiKey);

export interface EmailData {
  to: string | string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
  if_he?: boolean; // Language flag: true for Hebrew, false for English
}

export async function sendEmail(emailData: EmailData) {
  // Determine template ID based on language flag
  // Temporarily disable templates to test with simple HTML
  const templateId = emailData.if_he 
    ? process.env.TEMPLATE_ID_PURCHASE_HE 
    : process.env.TEMPLATE_ID_PURCHASE_EN;
  
  try {
    const msg: any = {
      to: emailData.to,
      from: emailData.from,
      subject: emailData.subject,
    };

    // Add content (either text or html is required)
    if (emailData.text) msg.text = emailData.text;
    if (emailData.html) msg.html = emailData.html;
    
    // Add template data if using templates
    if (templateId) {
      msg.templateId = templateId;
      if (emailData.dynamicTemplateData) {
        msg.dynamicTemplateData = emailData.dynamicTemplateData;
      }
    } else {
      // Fallback to simple HTML email if no template
      msg.html = `
        <h2>Order Confirmation</h2>
        <p>Thank you for your order!</p>
        <p><strong>Order ID:</strong> ${emailData.dynamicTemplateData?.order_number || 'N/A'}</p>
        <p><strong>Customer:</strong> ${emailData.dynamicTemplateData?.customer_name || 'N/A'}</p>
        <p><strong>Total:</strong> ${emailData.dynamicTemplateData?.total || 'N/A'}</p>
        <p>Best regards,<br>Sako-Or Team</p>
      `;
    }

    const response = await sgMail.send(msg);
    console.log('Email sent successfully:', response[0].statusCode);
    return { success: true, messageId: response[0].headers['x-message-id'] };
  } catch (error: any) {
    console.error('Error sending email:', error);
    console.error('Email data that failed:', JSON.stringify(emailData, null, 2));
    console.error('Template ID being used:', templateId);
    console.error('SendGrid error response:', error.response?.body);
    console.error('SendGrid error code:', error.code);
    return { success: false, error: error };
  }
}

// Helper function for sending order confirmation emails
export async function sendOrderConfirmationEmail(
  customerEmail: string,
  orderData: {
    orderId: string;
    customerName: string;
    totalAmount: number;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    if_he?: boolean; // Language flag
    // Additional order data for templates
    orderDate?: string;
    shippingMethod?: string;
    shippingCost?: number;
    discountCode?: string;
    discountAmount?: number;
    total?: number;
    paymentMethod?: string;
    shippingName?: string;
    shippingAddress?: string;
    shippingCity?: string;
    shippingState?: string;
    shippingZip?: string;
    shippingCountry?: string;
    shippingPhone?: string;
  }
) {
  // Determine subject based on language
  const subject = orderData.if_he 
    ? `אישור הזמנה - ${orderData.orderId}`
    : `Order Confirmation - ${orderData.orderId}`;

  const emailData: EmailData = {
    to: customerEmail,
    from: 'info@sako-or.com',
    subject: subject,
    if_he: orderData.if_he,
    dynamicTemplateData: {
      customer_name: orderData.customerName,
      order_number: orderData.orderId,
      order_date: orderData.orderDate || new Date().toLocaleDateString(),
      items: orderData.items,
      subtotal: orderData.totalAmount,
      shipping_method: orderData.shippingMethod || '',
      shipping_cost: orderData.shippingCost || 0,
      discount_code: orderData.discountCode || '',
      discount_amount: orderData.discountAmount || 0,
      total: orderData.total || orderData.totalAmount,
      payment_method: orderData.paymentMethod || '',
      shipping_name: orderData.shippingName || orderData.customerName,
      shipping_address: orderData.shippingAddress || '',
      shipping_city: orderData.shippingCity || '',
      shipping_state: orderData.shippingState || '',
      shipping_zip: orderData.shippingZip || '',
      shipping_country: orderData.shippingCountry || '',
      shipping_phone: orderData.shippingPhone || '',
    },
  };

  return await sendEmail(emailData);
}
