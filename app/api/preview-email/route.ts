import { NextRequest, NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { OrderConfirmationEmail } from '@/app/emails/order-confirmation';

export async function GET(request: NextRequest) {
  try {
    // Sample data for preview
    const sampleData = {
      customerName: 'John Doe',
      orderNumber: 'ORD-2024-001',
      orderDate: 'January 15, 2024',
      items: [
        { 
          name: 'Premium Leather Shoes', 
          sku: 'SHOES-001',
          size: 'L',
          quantity: 1, 
          price: 299.99 
        },
        { 
          name: 'Cotton Socks', 
          sku: 'SOCKS-002',
          size: 'M',
          quantity: 2, 
          price: 15.50 
        },
      ],
      total: 330.99,
      subtotal: 350.99,
      deliveryFee: 0,
      discountTotal: 20,
      coupons: [
        { code: 'SUMMER20', discountAmount: 15, discountLabel: '20% off selected items' },
        { code: 'FREESHIP', discountAmount: 5 }
      ],
      payer: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'avshi@sako-or.com',
        mobile: '+972-50-123-4567',
        idNumber: '123456789'
      },
      deliveryAddress: {
        city: 'Tel Aviv',
        streetName: 'Rothschild Boulevard',
        streetNumber: '15',
        floor: '3',
        apartmentNumber: '12',
        zipCode: '66881'
      },
      notes: 'Please deliver after 5 PM',
      isHebrew: true,
    };

    const html = await render(OrderConfirmationEmail(sampleData));
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Error generating email preview:', error);
    return new NextResponse('Error generating email preview', { status: 500 });
  }
}
