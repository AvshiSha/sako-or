import { NextRequest, NextResponse } from 'next/server';
import { sendOrderConfirmationEmail } from '@/lib/sendgrid';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();
    
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Fetch order with items
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderId },
      include: { orderItems: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!order.customerEmail) {
      return NextResponse.json({ error: 'Order missing customer email' }, { status: 400 });
    }

    // Build items for template
    const items = order.orderItems.map(item => ({
      name: item.productName,
      quantity: item.quantity,
      price: item.price,
    }));

    // Send confirmation email (default to English for testing)
    const result = await sendOrderConfirmationEmail(order.customerEmail, {
      orderId: order.orderNumber,
      customerName: order.customerName || '',
      totalAmount: order.total,
      items,
      if_he: false, // Test with English first
      orderDate: new Date(order.createdAt).toLocaleDateString(),
      paymentMethod: 'cardcom',
      total: order.total,
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Email sent successfully',
      result 
    });

  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json({ 
      error: 'Failed to send email',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
