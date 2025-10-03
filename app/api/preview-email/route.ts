import { NextRequest, NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { OrderConfirmationEmail } from '@/app/components/email-template';

export async function GET(request: NextRequest) {
  try {
    // Sample data for preview
    const sampleData = {
      customerName: 'John Doe',
      orderNumber: 'ORD-2024-001',
      orderDate: 'January 15, 2024',
      items: [
        { name: 'Premium Leather Shoes', quantity: 1, price: 299.99 },
        { name: 'Cotton Socks', quantity: 2, price: 15.50 },
      ],
      total: 330.99,
      isHebrew: false,
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
