import { NextRequest, NextResponse } from 'next/server';
import { CardComAPI } from '../../../../lib/cardcom';
import { LowProfileResult } from '../../../../app/types/cardcom';
import { prisma } from '../../../../lib/prisma';
import { stringifyPaymentData } from '../../../../lib/orders';
import { markCartItemsAsPurchased } from '../../../../lib/cart-status';
import { handlePostPaymentActions } from '../../../../lib/post-payment-actions';
import { productService } from '../../../../lib/firebase';
import { parseSku } from '../../../../lib/sku-parser';
import { createVerifoneInvoiceAsync } from '../../../../lib/verifone-invoice-job';
import {
  decrementInventoryForOrder,
  InsufficientStockError,
} from '../../../../lib/inventory';

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

    // Attempt to decrement inventory before finalizing the order.
    // This ensures we never mark an order as completed if we cannot fulfill it from stock.
    try {
      await decrementInventoryForOrder(orderId);
    } catch (error: any) {
      if (error instanceof InsufficientStockError) {
        console.error(
          '[CARDCom Webhook] Insufficient stock when processing order',
          {
            orderId,
            details: error.details,
          }
        );

        // Mark order as out_of_stock while keeping paymentStatus as completed
        // so finance can clearly see that payment was taken.
        await prisma.order.update({
          where: { orderNumber: orderId },
          data: {
            status: 'out_of_stock',
            paymentStatus: 'completed',
            paymentData: stringifyPaymentData({
              ...transactionData,
              inventoryError: 'INSUFFICIENT_STOCK',
              inventoryDetails: error.details,
            }),
            cardcomLowProfileId: transactionData.lowProfileId,
            cardcomTransactionId: transactionData.transactionId?.toString(),
            updatedAt: new Date(),
          },
        });

        // We deliberately do not mark cart items as PURCHASED or send confirmation emails here.
        return NextResponse.json({
          success: false,
          status: 'out_of_stock',
          message:
            'One or more items in the order are no longer in stock. Our support team will contact the customer.',
        });
      }

      console.error(
        '[CARDCom Webhook] Failed to decrement inventory for order',
        {
          orderId,
          error,
        }
      );

      // Mark order as failed due to inventory error but still note that payment was completed.
      await prisma.order.update({
        where: { orderNumber: orderId },
        data: {
          status: 'failed',
          paymentStatus: 'completed',
          paymentData: stringifyPaymentData({
            ...transactionData,
            inventoryError: 'INVENTORY_UPDATE_FAILED',
          }),
          cardcomLowProfileId: transactionData.lowProfileId,
          cardcomTransactionId: transactionData.transactionId?.toString(),
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: false,
        status: 'inventory_error',
        message:
          'Payment was received, but stock could not be confirmed. Support will review this order.',
      });
    }

    // Update order status to completed
    await updateOrderStatus(orderId, 'completed', transactionData);

    // If token was created, save it for future payments
    if (body.TokenInfo && body.Operation?.includes('Token')) {
      await savePaymentToken(orderId, body.TokenInfo);
    }

    // Trigger Verifone invoice creation async (non-blocking)
    console.log('[VERIFONE_INVOICE] Triggering Verifone invoice creation from webhook', {
      orderId,
      hasTransactionInfo: !!body.TranzactionInfo
    })
    createVerifoneInvoiceAsync(orderId, {
      transactionInfo: body.TranzactionInfo
    }).catch(err => {
      console.error('[VERIFONE_INVOICE] Failed to trigger invoice creation:', err);
      // Don't fail webhook - order still succeeds
    });

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
      // Ensure order items have all required data
      await ensureOrderItemsComplete(orderId);
    }
    
  } catch (error) {
    console.error('Failed to update order status:', error);
    throw error;
  }
}

/**
 * Ensure order items have all required data (primaryImage, salePrice, modelNumber)
 * Fetches missing data from Firebase if needed
 */
async function ensureOrderItemsComplete(orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderId },
      include: { orderItems: true }
    });

    if (!order) {
      console.warn(`[ensureOrderItemsComplete] Order not found: ${orderId}`);
      return;
    }

    // Check if any items are missing required data
    const itemsNeedingUpdate = order.orderItems.filter(
      item => !item.primaryImage || !item.modelNumber
    );

    if (itemsNeedingUpdate.length === 0) {
      return; // All items already have required data
    }

    console.log(`[ensureOrderItemsComplete] Updating ${itemsNeedingUpdate.length} items for order ${orderId}`);

    // Update each item that needs data
    for (const item of itemsNeedingUpdate) {
      try {
        const parsedSku = parseSku(item.productSku);
        const baseSku = parsedSku.baseSku || item.productSku;
        // Convert colorName to colorSlug (lowercase, for Firebase lookup)
        const itemColorName = item.colorName || parsedSku.colorName;
        const colorSlug = itemColorName ? itemColorName.toLowerCase() : null;

        // Fetch product from Firebase
        const product = await productService.getProductByBaseSku(baseSku);
        
        if (!product) {
          console.warn(`[ensureOrderItemsComplete] Product not found for SKU: ${baseSku}`);
          continue;
        }

        const variant = colorSlug && product.colorVariants?.[colorSlug] 
          ? product.colorVariants[colorSlug] 
          : null;
        
        // Get primary image
        const primaryImage = variant?.primaryImage || (variant && Array.isArray(variant.images) && variant.images.length > 0 ? variant.images[0] : null) || null;
        
        // Get sale price - only use if it's a valid discount (less than regular price)
        let salePrice = variant?.salePrice || product.salePrice || null;
        // Validate: salePrice must be less than item.price to be a valid discount
        if (salePrice != null && salePrice > 0 && salePrice >= item.price) {
          console.warn(`[ensureOrderItemsComplete] Invalid salePrice (${salePrice}) >= price (${item.price}) for item ${item.id}, setting to null`);
          salePrice = null;
        }

        // Generate model number
        const modelColorName = variant && variant.colorSlug
          ? variant.colorSlug.charAt(0).toUpperCase() + variant.colorSlug.slice(1)
          : itemColorName;
        
        const modelNumber = modelColorName 
          ? `${baseSku}-${modelColorName.toUpperCase()}` 
          : baseSku;

        // Update the order item
        await prisma.orderItem.update({
          where: { id: item.id },
          data: {
            primaryImage: item.primaryImage || primaryImage,
            salePrice: item.salePrice !== null ? item.salePrice : salePrice,
            modelNumber: item.modelNumber || modelNumber
          }
        });

        console.log(`[ensureOrderItemsComplete] Updated item ${item.id} for order ${orderId}`);
      } catch (itemError) {
        console.error(`[ensureOrderItemsComplete] Error updating item ${item.id}:`, itemError);
        // Continue with other items
      }
    }
  } catch (error) {
    console.error(`[ensureOrderItemsComplete] Error ensuring order items complete for ${orderId}:`, error);
    // Don't throw - this is best-effort data enrichment
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

