import { NextRequest, NextResponse } from 'next/server';
import { CardComAPI, createPaymentSessionRequest } from '../../../../lib/cardcom';
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

    // Generate order number - always use server-side generation for uniqueness
    let orderNumber = generateOrderNumber();
    
    // Check if the provided order ID exists and handle accordingly
    if (body.orderId) {
      const existingOrder = await prisma.order.findUnique({
        where: { orderNumber: body.orderId }
      });
      
      if (existingOrder) {
        // If order exists and is in a failed/cancelled state, we can reuse it
        if (existingOrder.status === 'failed' || existingOrder.status === 'cancelled') {
          console.log(`Reusing existing failed/cancelled order: ${body.orderId}`);
          orderNumber = body.orderId;
          
          // Delete the old order to recreate it
          await prisma.order.delete({
            where: { orderNumber: body.orderId }
          });
        } else {
          // Order exists and is pending/processing/completed - generate new order number
          console.log(`Order ${body.orderId} already exists with status ${existingOrder.status}, generating new order number`);
          orderNumber = generateOrderNumber();
        }
      } else {
        // Order doesn't exist, we can use the provided ID
        orderNumber = body.orderId;
      }
    }

    // Create order in database
    let order;
    try {
      order = await createOrder({
        orderNumber,
        total: body.amount,
        currency: body.currencyIso === 2 ? 'USD' : 'ILS',
        customerName: `${body.customer.firstName} ${body.customer.lastName}`,
        customerEmail: body.customer.email,
        customerPhone: body.customer.mobile,
        items: [{
          productName: body.productName || 'Sako Order',
          productSku: body.productSku || 'UNKNOWN',
          quantity: body.quantity || 1,
          price: body.amount,
        }],
      });
    } catch (createError: any) {
      // If we still get a unique constraint error, retry with a new order number
      if (createError.code === 'P2002') {
        console.log('Duplicate order number detected, generating new one');
        orderNumber = generateOrderNumber();
        order = await createOrder({
          orderNumber,
          total: body.amount,
          currency: body.currencyIso === 2 ? 'USD' : 'ILS',
          customerName: `${body.customer.firstName} ${body.customer.lastName}`,
          customerEmail: body.customer.email,
          customerPhone: body.customer.mobile,
          items: [{
            productName: body.productName || 'Sako Order',
            productSku: body.productSku || 'UNKNOWN',
            quantity: body.quantity || 1,
            price: body.amount,
          }],
        });
      } else {
        throw createError;
      }
    }

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
        createDocument: true,
        language: body.language || 'he',
        // Receipt/Document options
        customerTaxId: "",
        customerAddress: `${body.deliveryAddress.streetName} ${body.deliveryAddress.streetNumber}`,
        customerAddress2: "",
        customerCity: body.deliveryAddress.city,
        customerMobile: body.customer.mobile,
        documentComments: `Order: ${orderNumber}`,
        departmentId: "", // You'll provide this value later
        Products: [{
          ProductID: body.productSku || 'SAKO-PRODUCT',
          Description: body.productName || 'Sako Order',
          Quantity: body.quantity || 1,
          UnitCost: body.amount,
          TotalLineCost: body.amount * (body.quantity || 1),
          IsVatFree: false
        }]
      }
    );

    // Call CardCom API
    console.log('CardCom request being sent:', JSON.stringify(cardcomRequest, null, 2));
    const cardcomAPI = new CardComAPI();
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
