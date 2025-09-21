import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { PaymentStatusResponse } from '../../../../app/types/checkout';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lpid = searchParams.get('lpid');

    if (!lpid) {
      return NextResponse.json(
        { error: 'Missing required parameter: lpid' },
        { status: 400 }
      );
    }

    // Find order by CardCom Low Profile ID
    const order = await prisma.order.findFirst({
      where: {
        cardcomLowProfileId: lpid
      },
      include: {
        orderItems: true,
        payments: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Determine payment status
    let status: 'pending' | 'success' | 'failed' | 'cancelled' = 'pending';
    
    if (order.paymentStatus === 'completed') {
      status = 'success';
    } else if (order.paymentStatus === 'failed') {
      status = 'failed';
    } else if (order.paymentStatus === 'cancelled') {
      status = 'cancelled';
    } else if (order.paymentStatus === 'pending') {
      status = 'pending';
    }

    // Get the latest payment if exists
    const latestPayment = order.payments[0];

    // Build response
    const response: PaymentStatusResponse = {
      status,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        currency: order.currency,
        status: order.status,
        paymentStatus: order.paymentStatus || 'pending',
        createdAt: order.createdAt.toISOString(),
        orderItems: order.orderItems.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          total: item.total
        }))
      }
    };

    // Add transaction details if payment exists
    if (latestPayment) {
      response.transaction = {
        id: latestPayment.id,
        amount: latestPayment.amount,
        currency: latestPayment.currency,
        last4Digits: latestPayment.last4Digits || '',
        cardBrand: latestPayment.cardBrand || '',
        status: latestPayment.status
      };
    }

    // TODO: Add document URL if document was created
    // This would require implementing document generation/storage
    // response.documentUrl = await getDocumentUrl(order.id);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching payment status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
