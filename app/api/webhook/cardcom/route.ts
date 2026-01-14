import { NextRequest, NextResponse } from 'next/server';
import { CardComAPI } from '../../../../lib/cardcom';
import { LowProfileResult } from '../../../../app/types/cardcom';
import { prisma } from '../../../../lib/prisma';
import { stringifyPaymentData } from '../../../../lib/orders';
import { markCartItemsAsPurchased } from '../../../../lib/cart-status';
import { handlePostPaymentActions } from '../../../../lib/post-payment-actions';

export async function POST(request: NextRequest) {
  try {
    // Check for bypass secret in header or URL parameter
    const bypassSecretHeader = request.headers.get('x-vercel-protection-bypass');
    const url = new URL(request.url);
    const bypassSecretParam = url.searchParams.get('bypass');
    const bypassSecret = bypassSecretHeader || bypassSecretParam;
    const expectedBypassSecret = process.env.RESEND_API_KEY;
    
    // Verify bypass secret if provided
    if (bypassSecret && expectedBypassSecret && bypassSecret !== expectedBypassSecret) {
      return NextResponse.json({ error: 'Invalid bypass secret' }, { status: 401 });
    }
    
    // Additional security: Check if bypass secret is provided
    if (!bypassSecret) {
      return NextResponse.json({ error: 'Missing bypass secret' }, { status: 401 });
    }

    const body: LowProfileResult = await request.json();
    
    // Validate webhook signature if configured
    const signature = request.headers.get('x-cardcom-signature');
    if (signature) {
      const cardcomAPI = new CardComAPI();
      if (!cardcomAPI.validateWebhookSignature(JSON.stringify(body), signature)) {
        console.error('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }


    // Check if the transaction was successful
    if (body.ResponseCode !== 0) {
      // Update order status to failed
      if (body.ReturnValue) {
        await updateOrderStatus(body.ReturnValue, 'failed', 'failed');
      }
      
      return NextResponse.json({ success: true });
    }

    // Process successful transaction
    const orderId = body.ReturnValue;
    if (!orderId) {
      return NextResponse.json({ error: 'No order ID' }, { status: 400 });
    }

    // Extract transaction details
    const transactionData = {
      lowProfileId: body.LowProfileId,
      transactionId: body.TranzactionId,
      operation: body.Operation,
      uiValues: body.UIValues,
      transactionInfo: body.TranzactionInfo,
      tokenInfo: body.TokenInfo,
      documentInfo: body.DocumentInfo,
    };

    // Update order status to completed
    await updateOrderStatus(orderId, 'completed', transactionData);

    // If token was created, save it for future payments
    if (body.TokenInfo && body.Operation?.includes('Token')) {
      await savePaymentToken(orderId, body.TokenInfo);
    }

    // Send confirmation email and SMS
    await handlePostPaymentActions(orderId, request.url);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ success: true });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-cardcom-signature',
    },
  });
}

/**
 * Update order status in the database
 */
async function updateOrderStatus(
  orderId: string, 
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
  data?: any
) {
  try {
    
    // Update order status and payment data
    await prisma.order.update({
      where: { orderNumber: orderId },
      data: {
        status,
        paymentStatus: status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'pending',
        paymentData: stringifyPaymentData(data),
        cardcomLowProfileId: data?.lowProfileId,
        cardcomTransactionId: data?.transactionId?.toString(),
        updatedAt: new Date(),
      },
    });

    // If payment was successful, create payment record
    if (status === 'completed' && data?.transactionInfo) {
      await prisma.payment.create({
        data: {
          order: {
            connect: { orderNumber: orderId }
          },
          amount: data.transactionInfo.Amount || 0,
          currency: data.transactionInfo.Currency || 'ILS',
          status: 'completed',
          paymentMethod: 'cardcom',
          cardcomLowProfileId: data.lowProfileId,
          cardcomTransactionId: data.transactionId?.toString(),
          cardcomResponseCode: data.transactionInfo.ResponseCode || 0,
          last4Digits: data.transactionInfo.Last4Digits,
          cardBrand: data.transactionInfo.Brand,
        },
      });
    }

    // Mark matching cart items as PURCHASED (Option 2: match order items only)
    if (status === 'completed') {
      await markCartItemsAsPurchased(orderId);
    }
    
  } catch (error) {
    console.error('Failed to update order status:', error);
    throw error;
  }
}


/**
 * Save payment token for future use
 */
async function savePaymentToken(orderId: string, tokenInfo: any) {
  try {
    
    // Get customer info from the order
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderId },
      select: { customerEmail: true, customerName: true }
    });
    
    await prisma.paymentToken.create({
      data: {
        token: tokenInfo.Token,
        last4Digits: tokenInfo.CardLast4Digits,
        cardExpiry: `${tokenInfo.CardMonth}/${tokenInfo.CardYear}`,
        cardBrand: tokenInfo.CardBrand,
        customerEmail: order?.customerEmail,
        customerName: order?.customerName,
      },
    });
    
  } catch (error) {
    console.error('Failed to save payment token:', error);
  }
}

