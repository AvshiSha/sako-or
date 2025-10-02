import { NextRequest, NextResponse } from 'next/server';
import { CardComAPI } from '../../../../lib/cardcom';
import { LowProfileResult } from '../../../../app/types/cardcom';
import { prisma } from '../../../../lib/prisma';
import { sendOrderConfirmationEmail } from '../../../../lib/email';
import { stringifyPaymentData } from '../../../../lib/orders';

export async function POST(request: NextRequest) {
  try {
    console.log('=== WEBHOOK CALLED ===');
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    
    const body: LowProfileResult = await request.json();
    console.log('Webhook body:', JSON.stringify(body, null, 2));
    
    // Validate webhook signature if configured
    const signature = request.headers.get('x-cardcom-signature');
    if (signature) {
      const cardcomAPI = new CardComAPI();
      if (!cardcomAPI.validateWebhookSignature(JSON.stringify(body), signature)) {
        console.error('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
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
    await handlePostPaymentActions(orderId, transactionData, request.url);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Always return 200 to CardCom to prevent retries
    // Log the error for debugging
    console.error('Webhook error details:', error);
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
async function handlePostPaymentActions(orderId: string, transactionData: any, requestUrl: string) {
  try {
    console.log(`Handling post-payment actions for order ${orderId}`);

    // Fetch order with items
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderId },
      include: { orderItems: true },
    });

    if (!order) {
      console.error('Order not found for email sending:', orderId);
      return;
    }

    if (!order.customerEmail) {
      console.error('Order missing customerEmail; skipping confirmation email');
      return;
    }

    // Build items for template
    const items = order.orderItems.map(item => ({
      name: item.productName,
      quantity: item.quantity,
      price: item.price,
    }));

    // Extract language from webhook URL parameters (more reliable than transaction data)
    console.log('=== LANGUAGE DETECTION DEBUG ===');
    const url = new URL(requestUrl);
    const langParam = url.searchParams.get('lang');
    console.log('Language from URL parameter:', langParam);
    console.log('Full webhook URL:', requestUrl);
    
    // Determine if Hebrew based on URL parameter (fallback to Hebrew if not provided)
    const if_he = langParam === 'he' || !langParam;
    console.log('Final if_he value:', if_he);
    console.log('Language detection method: URL parameter');
    console.log('=== END LANGUAGE DETECTION DEBUG ===');

    // Send confirmation email with Resend
    const emailResult = await sendOrderConfirmationEmail({
      customerEmail: order.customerEmail,
      customerName: order.customerName || '',
      orderNumber: order.orderNumber,
      orderDate: new Date(order.createdAt).toLocaleDateString(),
      items: items,
      total: order.total,
      isHebrew: if_he,
    });

    if (emailResult.success) {
      console.log('Confirmation email sent successfully for order:', order.orderNumber);
    } else {
      console.error('Failed to send confirmation email:', emailResult.error);
    }
    
  } catch (error) {
    console.error('Failed to handle post-payment actions:', error);
    // Don't throw - this is not critical for the payment flow
  }
}
