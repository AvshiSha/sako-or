import { NextRequest, NextResponse } from 'next/server';
import { cardcomAPI, createPaymentSessionRequest } from '../../../../lib/cardcom';
import { CreateLowProfileRequest } from '../../../../app/types/checkout';
import { createOrder, generateOrderNumber } from '../../../../lib/orders';
import { prisma } from '../../../../lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body: CreateLowProfileRequest = await request.json();
    console.log('Payment request received:', JSON.stringify(body, null, 2));
    
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

    if (!body.customer.firstName || !body.customer.lastName || !body.customer.email || !body.customer.mobile) {
      return NextResponse.json(
        { error: 'Missing required customer information' },
        { status: 400 }
      );
    }

    if (!body.deliveryAddress.city || !body.deliveryAddress.streetName || !body.deliveryAddress.streetNumber) {
      return NextResponse.json(
        { error: 'Missing required delivery address information' },
        { status: 400 }
      );
    }

    // Generate order number if not provided
    const orderNumber = body.orderId || generateOrderNumber();

    // Create order in database first
    const order = await createOrder({
      orderNumber,
      total: body.amount,
      currency: body.currencyIso === 2 ? 'USD' : 'ILS',
      customerName: `${body.customer.firstName} ${body.customer.lastName}`,
      customerEmail: body.customer.email,
      customerPhone: body.customer.mobile,
      items: [{
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
      body.currencyIso === 2 ? 'USD' : 'ILS',
      {
        customerEmail: body.customer.email,
        customerName: `${body.customer.firstName} ${body.customer.lastName}`,
        customerPhone: body.customer.mobile,
        productName: body.productName,
        createToken: false,
        createDocument: false,
        language: body.language || 'he',
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
      currency: body.currencyIso === 2 ? 'USD' : 'ILS',
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
