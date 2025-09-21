import { NextRequest, NextResponse } from 'next/server';
import { cardcomAPI } from '../../../../lib/cardcom';
import { LowProfileResult } from '../../../../app/types/cardcom';
import { prisma } from '../../../../lib/prisma';
import { stringifyPaymentData } from '../../../../lib/orders';

export async function POST(request: NextRequest) {
  try {
    const body: LowProfileResult = await request.json();
    
    // Validate webhook signature if configured
    const signature = request.headers.get('x-cardcom-signature');
    if (signature && !cardcomAPI.validateWebhookSignature(JSON.stringify(body), signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Log the webhook for debugging
    console.log('CardCom webhook received:', {
      lowProfileId: body.LowProfileId,
      responseCode: body.ResponseCode,
      orderId: body.ReturnValue,
      operation: body.Operation,
    });

    // Check if the transaction was successful
    if (body.ResponseCode !== 0) {
      console.error('CardCom transaction failed:', {
        responseCode: body.ResponseCode,
        description: body.Description,
        orderId: body.ReturnValue,
      });
      
      // Update order status to failed
      if (body.ReturnValue) {
        await updateOrderStatus(body.ReturnValue, 'failed', 'failed');
      }
      
      return NextResponse.json({ success: true });
    }

    // Process successful transaction
    const orderId = body.ReturnValue;
    if (!orderId) {
      console.error('No order ID in webhook');
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

    // If document was created, log the document info
    if (body.DocumentInfo) {
      console.log('Document created:', {
        orderId,
        documentId: body.DocumentInfo.DocumentId,
        documentUrl: body.DocumentInfo.DocumentUrl,
      });
    }

    // Send confirmation email or other post-payment actions
    await handlePostPaymentActions(orderId, transactionData);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Always return 200 to CardCom to prevent retries
    // Log the error for debugging
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
    console.log(`Updating order ${orderId} to status: ${status}`, data);
    
    // Update order status and payment data
    await prisma.order.update({
      where: { orderNumber: orderId }, // Using orderNumber as the identifier
      data: {
        status,
        paymentStatus: status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'pending',
        paymentData: stringifyPaymentData(data), // Store as JSON string for SQLite
        cardcomLowProfileId: data?.lowProfileId,
        cardcomTransactionId: data?.transactionId,
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
          cardcomTransactionId: data.transactionId,
          cardcomResponseCode: data.transactionInfo.ResponseCode || 0,
          last4Digits: data.transactionInfo.Last4Digits,
          cardBrand: data.transactionInfo.Brand,
        },
      });
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
    console.log(`Saving payment token for order ${orderId}:`, {
      token: tokenInfo.Token,
      cardLast4: tokenInfo.CardLast4Digits,
      expiry: `${tokenInfo.CardMonth}/${tokenInfo.CardYear}`,
    });
    
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
    // Don't throw - this is not critical for the payment flow
  }
}

/**
 * Handle post-payment actions (emails, notifications, etc.)
 */
async function handlePostPaymentActions(orderId: string, transactionData: any) {
  try {
    // TODO: Implement post-payment actions
    // - Send confirmation email
    // - Update inventory
    // - Send notifications
    // - Generate receipts
    
    console.log(`Handling post-payment actions for order ${orderId}`);
    
    // Example implementation:
    // await sendOrderConfirmationEmail(orderId);
    // await updateInventory(orderId);
    // await sendAdminNotification(orderId);
    
  } catch (error) {
    console.error('Failed to handle post-payment actions:', error);
    // Don't throw - this is not critical for the payment flow
  }
}
