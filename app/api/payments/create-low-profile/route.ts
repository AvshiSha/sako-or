import { NextRequest, NextResponse } from 'next/server';
import { CardComAPI, createPaymentSessionRequest } from '../../../../lib/cardcom';
import { CreateLowProfileRequest } from '../../../../app/types/checkout';
import { createOrder, generateOrderNumber } from '../../../../lib/orders';
import { prisma } from '../../../../lib/prisma';
import { adminAuth } from '../../../../lib/firebase-admin';
import { spendPointsForOrder } from '../../../../lib/points';

export async function POST(request: NextRequest) {
  try {
    const body: CreateLowProfileRequest = await request.json();
    console.log('Payment request received:', JSON.stringify(body, null, 2));

    // Optional auth: if a Firebase bearer token is provided, link the order to that user.
    const authHeader = request.headers.get('authorization') || '';
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const bearerToken = tokenMatch?.[1] ?? null;
    let userId: string | undefined = undefined;

    if (bearerToken) {
      try {
        const decoded = await adminAuth.verifyIdToken(bearerToken);
        const firebaseUid = decoded.uid;
        const email = decoded.email ?? null;
        const emailVerified = decoded.email_verified ?? false;
        const now = new Date();

        const user = await prisma.user.upsert({
          where: { firebaseUid },
          update: {
            lastLoginAt: now,
            ...(email ? { email } : {}),
            emailVerified
          },
          create: {
            firebaseUid,
            email,
            emailVerified,
            authProvider: 'firebase',
            role: 'USER',
            lastLoginAt: now
          }
        });

        userId = user.id;
      } catch {
        // Treat invalid/expired token as guest checkout
        console.warn('[CREATE_LOW_PROFILE] Invalid bearer token, proceeding as guest');
      }
    }
    
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

    const pointsToSpend = body.pointsToSpend ? Math.trunc(body.pointsToSpend) : 0;
    if (pointsToSpend > 0 && !userId) {
      return NextResponse.json(
        { error: 'Must be logged in to spend points' },
        { status: 401 }
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

    // Prepare order items - use items array if provided, otherwise fallback to single product
    const orderItems = body.items && body.items.length > 0
      ? body.items.map(item => ({
          productName: item.productName,
          productSku: item.productSku,
          quantity: item.quantity,
          price: item.price, // Price per unit
          colorName: item.color,
          size: item.size,
        }))
      : [{
          productName: body.productName || 'Sako Order',
          productSku: body.productSku || 'UNKNOWN',
          quantity: body.quantity || 1,
          price: body.amount / (body.quantity || 1), // Calculate unit price from total
        }];

    const requestedCouponCodes = body.coupons?.map(coupon => coupon.code.toUpperCase()) ?? [];
    const couponRecords = requestedCouponCodes.length > 0
      ? await prisma.coupon.findMany({
          where: {
            code: {
              in: requestedCouponCodes
            }
          }
        })
      : [];
    const couponMap = new Map<string, string>();
    couponRecords.forEach(record => {
      couponMap.set(record.code.toUpperCase(), record.id);
    });

    const computedSubtotal = body.subtotal ?? orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const computedDeliveryFee = body.deliveryFee ?? Math.max(body.amount - (computedSubtotal - (body.discountTotal ?? 0)), 0);
    const computedDiscountTotal = body.discountTotal ?? Math.max(computedSubtotal + computedDeliveryFee - body.amount, 0);

    // Create order in database
    let order;
    try {
      order = await createOrder({
        orderNumber,
        total: body.amount,
        subtotal: computedSubtotal,
        discountTotal: computedDiscountTotal,
        deliveryFee: computedDeliveryFee,
        currency: body.currencyIso === 2 ? 'USD' : 'ILS',
        customerName: `${body.customer.firstName} ${body.customer.lastName}`,
        customerEmail: body.customer.email,
        customerPhone: body.customer.mobile,
        userId,
        items: orderItems,
        coupons: body.coupons?.map(coupon => ({
          code: coupon.code,
          discountAmount: coupon.discountAmount,
          discountType: coupon.discountType,
          stackable: coupon.stackable,
          description: coupon.description,
          couponId: couponMap.get(coupon.code.toUpperCase())
        }))
      });
    } catch (createError: any) {
      // If we still get a unique constraint error, retry with a new order number
      if (createError.code === 'P2002') {
        console.log('Duplicate order number detected, generating new one');
        orderNumber = generateOrderNumber();
        order = await createOrder({
          orderNumber,
          total: body.amount,
          subtotal: computedSubtotal,
          discountTotal: computedDiscountTotal,
          deliveryFee: computedDeliveryFee,
          currency: body.currencyIso === 2 ? 'USD' : 'ILS',
          customerName: `${body.customer.firstName} ${body.customer.lastName}`,
          customerEmail: body.customer.email,
          customerPhone: body.customer.mobile,
          userId,
          items: orderItems,
          coupons: body.coupons?.map(coupon => ({
            code: coupon.code,
            discountAmount: coupon.discountAmount,
            discountType: coupon.discountType,
            stackable: coupon.stackable,
            description: coupon.description
          }))
        });
      } else {
        throw createError;
      }
    }

    // If points were used as a discount, create a SPEND row linked to the order and update user balance.
    if (pointsToSpend > 0 && userId) {
      try {
        await spendPointsForOrder({
          userId,
          orderId: order.id,
          pointsToSpend
        });
      } catch (pointsError: any) {
        console.error('[POINTS_SPEND_ERROR]', pointsError);
        // Avoid leaving an order in a discounted state if spend failed
        await prisma.order.delete({ where: { id: order.id } });
        return NextResponse.json(
          {
            error: 'Failed to spend points for order',
            details: typeof pointsError?.message === 'string' ? pointsError.message : 'Unknown error'
          },
          { status: 400 }
        );
      }
    }

    // Prepare Cardcom products - use items array if provided, otherwise fallback to single product
    const cardcomProducts = body.items && body.items.length > 0
      ? body.items.map(item => ({
          ProductID: item.productSku,
          Description: item.productName,
          Quantity: item.quantity,
          UnitCost: item.price, // Price per unit
          TotalLineCost: item.price * item.quantity, // Total for this line
          IsVatFree: false
        }))
      : [{
          ProductID: body.productSku || 'SAKO-PRODUCT',
          Description: body.productName || 'Sako Order',
          Quantity: body.quantity || 1,
          UnitCost: body.amount / (body.quantity || 1), // Calculate unit price
          TotalLineCost: body.amount, // Total should match the charge amount
          IsVatFree: false
        }];

    // Apply order-level discounts proportionally to CardCom products so document totals match charge amount
    if (computedDiscountTotal > 0 && cardcomProducts.length > 0) {
      const subtotalBeforeDiscount = cardcomProducts.reduce((sum, product) => {
        return sum + (product.UnitCost * product.Quantity);
      }, 0);

      if (subtotalBeforeDiscount > 0) {
        let remainingDiscount = parseFloat(computedDiscountTotal.toFixed(2));

        cardcomProducts.forEach((product, index) => {
          const quantity = product.Quantity && product.Quantity > 0 ? product.Quantity : 1;
          const originalLineTotal = product.UnitCost * quantity;

          let lineDiscount: number;
          if (index === cardcomProducts.length - 1) {
            lineDiscount = remainingDiscount;
          } else {
            lineDiscount = parseFloat(((originalLineTotal / subtotalBeforeDiscount) * computedDiscountTotal).toFixed(2));
            // Guard against rounding pushing discount beyond remaining amount
            if (lineDiscount > remainingDiscount) {
              lineDiscount = remainingDiscount;
            }
            remainingDiscount = parseFloat((remainingDiscount - lineDiscount).toFixed(2));
          }

          const discountedLineTotal = parseFloat((originalLineTotal - lineDiscount).toFixed(2));
          const discountedUnitCost = parseFloat((discountedLineTotal / quantity).toFixed(2));

          product.UnitCost = discountedUnitCost;
          product.TotalLineCost = parseFloat((discountedUnitCost * quantity).toFixed(2));
        });
      }
    }

    // Verify the total matches
    const calculatedTotal = cardcomProducts.reduce((sum, product) => sum + product.TotalLineCost, 0);
    if (Math.abs(calculatedTotal - body.amount) > 0.01) {
      console.warn(`Total mismatch: calculated ${calculatedTotal} vs amount ${body.amount}`);
      // Adjust the last product to match the total
      if (cardcomProducts.length > 0) {
        const difference = body.amount - calculatedTotal;
        const lastProduct = cardcomProducts[cardcomProducts.length - 1];
        lastProduct.TotalLineCost = parseFloat((lastProduct.TotalLineCost + difference).toFixed(2));
        if (lastProduct.Quantity && lastProduct.Quantity > 0) {
          lastProduct.UnitCost = parseFloat((lastProduct.TotalLineCost / lastProduct.Quantity).toFixed(2));
        }
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
        productName: body.items && body.items.length > 0
          ? body.items.map(item => `${item.productName} x${item.quantity}`).join(', ')
          : body.productName,
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
        departmentId: "",
        Products: cardcomProducts
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
