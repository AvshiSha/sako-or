import { sendOrderConfirmationEmailIdempotent } from '../../../lib/email';

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
          sku: 'SKU-TEST-123',
          size: 'M',
          quantity: 1,
          price: 100.00
        }
      ],
      total: body.total || 100.00,
      payer: body.payer || {
        firstName: 'Test',
        lastName: 'Customer',
        email: body.email || 'avshi@sako-or.com',
        mobile: '+972-50-123-4567',
        idNumber: '123456789'
      },
      deliveryAddress: body.deliveryAddress || {
        city: 'Tel Aviv',
        streetName: 'Herzl Street',
        streetNumber: '1',
        floor: '2',
        apartmentNumber: '10',
        zipCode: '66881'
      },
      notes: body.notes || 'Test order',
      isHebrew: body.isHebrew || false,
    };

    const result = await sendOrderConfirmationEmailIdempotent(emailData);
    
    if (!result.success) {
      return Response.json({ error: 'error' in result ? result.error : 'Unknown error' }, { status: 500 });
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
