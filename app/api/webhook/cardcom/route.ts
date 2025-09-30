import { NextRequest, NextResponse } from 'next/server';
import { CardComAPI } from '../../../../lib/cardcom';
import { LowProfileResult } from '../../../../app/types/cardcom';
import { prisma } from '../../../../lib/prisma';
import { sendOrderConfirmationEmail } from '../../../../lib/email';
import { stringifyPaymentData } from '../../../../lib/orders';

export async function POST(request: NextRequest) {
  try {
    console.log('=== WEBHOOK CALLED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL:', request.url);
    console.log('Method:', request.method);
    
    // Verify this is actually from CardCom
    const userAgent = request.headers.get('user-agent') || '';
    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    
    console.log('User-Agent:', userAgent);
    console.log('X-Forwarded-For:', forwardedFor);
    
    // Check for bypass secret in header or URL parameter
    const bypassSecretHeader = request.headers.get('x-vercel-protection-bypass');
    const url = new URL(request.url);
    const bypassSecretParam = url.searchParams.get('bypass');
    const bypassSecret = bypassSecretHeader || bypassSecretParam;
    const expectedBypassSecret = process.env.RESEND_API_KEY;
    
    console.log('Webhook Debug Info:', {
      bypassSecretHeader,
      bypassSecretParam,
      bypassSecret,
      expectedBypassSecret: expectedBypassSecret ? 'SET' : 'NOT SET',
      url: request.url
    });
    
    // Verify bypass secret if provided
    if (bypassSecret && expectedBypassSecret && bypassSecret !== expectedBypassSecret) {
      console.log('Invalid bypass secret provided');
      return NextResponse.json({ error: 'Invalid bypass secret' }, { status: 401 });
    }
    
    // Basic security check - CardCom should have specific user agent or IP ranges
    // Temporarily disabled for testing - CardCom will have proper user-agent
    // if (!userAgent.includes('CardCom') && !forwardedFor.includes('cardcom')) {
    //   console.log('Suspicious webhook call:', { userAgent, forwardedFor });
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

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

    // Send confirmation email
    await handlePostPaymentActions(orderId, transactionData);

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
    console.log(`Updating order ${orderId} to status: ${status}`, data);
    
    // Update order status and payment data
    await prisma.order.update({
      where: { orderNumber: orderId },
      data: {
        status,
        paymentStatus: status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'pending',
        paymentData: stringifyPaymentData(data),
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
  }
}

/**
 * Handle post-payment actions (emails, notifications, etc.)
 */
async function handlePostPaymentActions(orderId: string, transactionData: any) {
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

    // Determine language flag from transaction (fallback to Hebrew if not provided)
    const if_he = transactionData?.uiValues?.Language === 'he' || false;

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
  }
}
