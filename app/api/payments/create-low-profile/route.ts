import { NextRequest, NextResponse } from 'next/server';
import { cardcomAPI, createPaymentSessionRequest } from '../../../../lib/cardcom';
import { CreatePaymentRequest } from '../../../../app/types/cardcom';
import { createOrder, generateOrderNumber } from '../../../../lib/orders';
import { prisma } from '../../../../lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body: CreatePaymentRequest = await request.json();
    console.log('Payment request received:', body);
    
    // Debug environment variables
    console.log('Environment variables:', {
      CARDCOM_TERMINAL_NUMBER: process.env.CARDCOM_TERMINAL_NUMBER ? 'Set' : 'Not set',
      CARDCOM_API_NAME: process.env.CARDCOM_API_NAME ? 'Set' : 'Not set',
      NODE_ENV: process.env.NODE_ENV,
    });
    
    // Validate required fields
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields: amount' },
        { status: 400 }
      );
    }

    // Generate order number if not provided
    const orderNumber = body.orderId || generateOrderNumber();

    // Create order in database first
    const order = await createOrder({
      orderNumber,
      total: body.amount,
      currency: body.currency || 'ILS',
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      items: body.items || [{
        productName: body.productName || 'Sako Order',
        productSku: 'UNKNOWN',
        quantity: 1,
        price: body.amount,
      }],
    });

    // Create CardCom payment session request
    const cardcomRequest = createPaymentSessionRequest(
      orderNumber,
      body.amount,
      body.currency || 'ILS',
      {
        customerEmail: body.customerEmail,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        productName: body.productName,
        createToken: body.createToken || false,
        createDocument: body.createDocument || false,
        language: 'he', // Default to Hebrew
        returnUrl: body.returnUrl,
      }
    );

    // Call CardCom API
    console.log('CardCom request being sent:', JSON.stringify(cardcomRequest, null, 2));
    const cardcomResponse = await cardcomAPI.createLowProfile(cardcomRequest);

    // Update order with CardCom Low Profile ID
    await prisma.order.update({
      where: { id: order.id },
      data: {
        cardcomLowProfileId: cardcomResponse.LowProfileId,
        status: 'processing',
        paymentStatus: 'processing',
      },
    });

    // Return the payment URL to the client
    return NextResponse.json({
      success: true,
      paymentUrl: cardcomResponse.Url,
      lowProfileId: cardcomResponse.LowProfileId,
      orderId: orderNumber,
      orderDbId: order.id,
      amount: body.amount,
      currency: body.currency || 'ILS',
    });

  } catch (error) {
    console.error('Payment creation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create payment session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
