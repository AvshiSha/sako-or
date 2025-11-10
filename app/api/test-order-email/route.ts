import { sendOrderConfirmationEmailIdempotent } from '../../../lib/email';

export async function POST(request: Request) {
  try {
    // Handle both JSON body and URL parameters
    let body: any = {};
    
    // Always check URL parameters first
    const url = new URL(request.url);
    const urlParams = {
      orderNumber: url.searchParams.get('orderNumber'),
      email: url.searchParams.get('email'),
      customerName: url.searchParams.get('customerName'),
      isHebrew: url.searchParams.get('isHebrew') === 'true',
      mock: url.searchParams.get('mock') === 'true'
    };
    
    try {
      const jsonBody = await request.json();
      // Merge JSON body with URL parameters (URL params take precedence)
      body = { ...jsonBody, ...urlParams };
    } catch (jsonError) {
      // If JSON parsing fails, use URL parameters only
      body = urlParams;
    }
    
    // Test email data
    const orderNumber = body.orderNumber || 'ORDER-TEST-' + Date.now();
    const emailData = {
      customerEmail: body.email || 'avshi@sako-or.com',
      customerName: body.customerName || 'Test Customer',
      orderNumber: orderNumber,
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
      subtotal: body.subtotal ?? body.total ?? 100.00,
      deliveryFee: body.deliveryFee ?? 0,
      discountTotal: body.discountTotal ?? 0,
      coupons: body.coupons || [
        { code: 'TEST10', discountAmount: 10, discountLabel: '10% off' }
      ],
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

    // Check if this is a mock test (no real email sending)
    const isMock = body.mock === 'true' || body.mock === true;
    
    // Production: minimal logging
    
    let result;
    if (isMock) {
      // Mock response for faster testing
      result = {
        success: true,
        messageId: 'mock-message-id-' + Date.now(),
        skipped: false,
        mock: true
      };
      console.log('[MOCK] Email test completed without sending real email');
    } else {
      result = await sendOrderConfirmationEmailIdempotent(emailData, orderNumber);
    }
    
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
