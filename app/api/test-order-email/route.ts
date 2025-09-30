import { sendOrderConfirmationEmail } from '../../../lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Test email data
    const emailData = {
      customerEmail: body.email || 'avshi@sako-or.com',
      customerName: body.customerName || 'Test Customer',
      orderNumber: body.orderNumber || 'ORDER-TEST-' + Date.now(),
      orderDate: new Date().toLocaleDateString(),
      items: body.items || [
        {
          name: 'Test Product',
          quantity: 1,
          price: 100.00
        }
      ],
      total: body.total || 100.00,
      isHebrew: body.isHebrew || false,
    };

    const result = await sendOrderConfirmationEmail(emailData);
    
    if (!result.success) {
      return Response.json({ error: result.error }, { status: 500 });
    }

    return Response.json({ 
      success: true, 
      messageId: result.messageId,
      emailData: emailData 
    });
  } catch (error) {
    console.error('Test email error:', error);
    return Response.json({ error: 'Failed to send test email' }, { status: 500 });
  }
}
