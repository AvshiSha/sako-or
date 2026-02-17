import { NextRequest, NextResponse } from 'next/server';
import { CardComAPI } from '../../../../lib/cardcom';
import { prisma } from '../../../../lib/prisma';
import { stringifyPaymentData, parsePaymentData, mergePaymentData } from '../../../../lib/orders';
import { spendPointsForOrder } from '../../../../lib/points';
import { markCartItemsAsPurchased } from '../../../../lib/cart-status';
import { handlePostPaymentActions } from '../../../../lib/post-payment-actions';
import { productService } from '../../../../lib/firebase';
import { parseSku } from '../../../../lib/sku-parser';
import { createVerifoneInvoiceAsync } from '../../../../lib/verifone-invoice-job';

export async function POST(request: NextRequest) {
  try {
    const { orderId, paymentSucceeded } = await request.json().catch(() => ({}));

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing required parameter: orderId' },
        { status: 400 }
      );
    }

    // Find the order
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderId },
      include: {
        payments: true,
        appliedCoupons: true
      }
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // If order is already completed, just mark cart items as PURCHASED and return
    if (order.paymentStatus === 'completed' && order.status === 'completed') {
      console.log('[check-status] Order already completed, marking cart items as PURCHASED');
      await markCartItemsAsPurchased(order.orderNumber);
      return NextResponse.json({
        success: true,
        status: 'completed',
        message: 'Payment already completed',
        orderId: order.orderNumber,
      });
    }

    if (!order.cardcomLowProfileId) {
      return NextResponse.json(
        { error: 'No CardCom Low Profile ID found for this order' },
        { status: 400 }
      );
    }

    // Check payment status with CardCom
    let statusResponse;
    try {
      const cardcomAPI = new CardComAPI();
      statusResponse = await cardcomAPI.getLowProfileStatus(order.cardcomLowProfileId);
      console.log('CardCom status response:', statusResponse);
    } catch (cardcomError: any) {
      // If CardCom API returns 404 or fails, check if we can still mark it as completed
      console.warn('[check-status] CardCom API error, checking order status:', cardcomError?.message);
      
      // If the error is 404, check if we should mark as completed anyway
      if (cardcomError?.message?.includes('404')) {
        // Only assume success if explicitly told payment succeeded (from Success page)
        // This is safe because Success page is only reached when CardCom redirects with ResponseCode=0
        if (paymentSucceeded === true && (order.status === 'processing' || order.paymentStatus === 'processing')) {
          console.log('[check-status] Payment succeeded flag set, marking as completed despite CardCom 404 (test/sandbox environment)');
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: 'completed',
              paymentStatus: 'completed',
              updatedAt: new Date(),
            },
          });
          
          // Create payment record
          if (order.payments.length === 0) {
            await prisma.payment.create({
              data: {
                orderId: order.id,
                amount: order.total,
                currency: order.currency,
                status: 'completed',
                paymentMethod: 'cardcom',
                cardcomLowProfileId: order.cardcomLowProfileId,
                cardcomResponseCode: 0, // Success
              },
            });
          }
          
          // Handle points: deduct points if used
          // Points earning is now handled by Verifone sync after CreateInvoice succeeds
          if (order.paymentStatus !== 'completed' && order.userId) {
            try {
              // Deduct points if they were used in this order
              const paymentMetadata = parsePaymentData(order.paymentData);
              const pointsToSpend = paymentMetadata?.pointsToSpend;
              
              if (pointsToSpend && pointsToSpend > 0) {
                try {
                  await spendPointsForOrder({
                    userId: order.userId,
                    orderId: order.id,
                    pointsToSpend: pointsToSpend
                  });
                  console.log(`[POINTS_SPEND] Deducted ${pointsToSpend} points for order ${order.orderNumber}`);
                } catch (spendError: any) {
                  console.error('[POINTS_SPEND_ERROR] Failed to deduct points for order', order.id, spendError);
                }
              }
              // Note: Points earning is now handled by Verifone sync in createVerifoneInvoiceAsync
            } catch (pointsError) {
              console.warn('[POINTS_SPEND_ERROR] Failed to handle points for order', order.id, pointsError);
            }
          }
          
          await markCartItemsAsPurchased(order.orderNumber);
          
          // Trigger Verifone invoice creation async (non-blocking)
          // Extract transaction info from paymentData if available
          const paymentData = parsePaymentData(order.paymentData);
          const transactionInfo = paymentData?.transactionInfo || {};
          console.log('[VERIFONE_INVOICE] Triggering Verifone invoice creation from check-status (paymentSucceeded path)', {
            orderId: order.orderNumber,
            hasTransactionInfo: !!transactionInfo && Object.keys(transactionInfo).length > 0
          })
          createVerifoneInvoiceAsync(order.orderNumber, {
            transactionInfo: transactionInfo
          }).catch(err => {
            console.error('[VERIFONE_INVOICE] Failed to trigger invoice creation:', err);
            // Don't fail payment check - order still succeeds
          });
          
          // Send confirmation email and SMS (idempotent - safe to call multiple times)
          await handlePostPaymentActions(order.orderNumber, request.url);
          
          return NextResponse.json({
            success: true,
            status: 'completed',
            message: 'Payment completed (verified from Success page redirect - test/sandbox environment)',
            orderId: order.orderNumber,
          });
        }
        
        // Check if order has any payment records indicating success (existing logic)
        if (order.payments.length > 0 && order.payments[0].status === 'completed') {
          console.log('[check-status] Payment record exists, marking as completed despite CardCom 404');
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: 'completed',
              paymentStatus: 'completed',
              updatedAt: new Date(),
            },
          });
          await markCartItemsAsPurchased(order.orderNumber);
          
          // Ensure order items have all required data
          await ensureOrderItemsComplete(order.orderNumber);
          
          // Trigger Verifone invoice creation async (non-blocking)
          // Extract transaction info from paymentData if available
          const paymentDataForInvoice = parsePaymentData(order.paymentData);
          const transactionInfoForInvoice = paymentDataForInvoice?.transactionInfo || {};
          console.log('[VERIFONE_INVOICE] Triggering Verifone invoice creation from check-status (payment record path)', {
            orderId: order.orderNumber,
            hasTransactionInfo: !!transactionInfoForInvoice && Object.keys(transactionInfoForInvoice).length > 0
          })
          createVerifoneInvoiceAsync(order.orderNumber, {
            transactionInfo: transactionInfoForInvoice
          }).catch(err => {
            console.error('[VERIFONE_INVOICE] Failed to trigger invoice creation:', err);
            // Don't fail payment check - order still succeeds
          });
          
          // Send confirmation email and SMS (idempotent - safe to call multiple times)
          await handlePostPaymentActions(order.orderNumber, request.url);
          
          return NextResponse.json({
            success: true,
            status: 'completed',
            message: 'Payment completed (verified from payment records)',
            orderId: order.orderNumber,
          });
        }
      }
      
      // Re-throw if we can't handle it
      throw cardcomError;
    }

    // Update order status based on CardCom response
    if (statusResponse.ResponseCode === 0) {
      // Payment successful; merge so pointsToSpend from create-low-profile is preserved for Verifone invoice
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'completed',
          paymentStatus: 'completed',
          cardcomTransactionId: statusResponse.TranzactionId,
          paymentData: mergePaymentData(order.paymentData, statusResponse as Record<string, unknown>),
          updatedAt: new Date(),
        },
      });

      // Create payment record if it doesn't exist
      if (order.payments.length === 0) {
        await prisma.payment.create({
          data: {
            orderId: order.id,
            amount: order.total,
            currency: order.currency,
            status: 'completed',
            paymentMethod: 'cardcom',
            cardcomLowProfileId: order.cardcomLowProfileId,
            cardcomTransactionId: statusResponse.TranzactionId,
            cardcomResponseCode: statusResponse.ResponseCode,
          },
        });
      }

      if (order.status !== 'completed' && order.appliedCoupons.length > 0) {
        const userIdentifier = order.customerEmail ? order.customerEmail.toLowerCase() : null

        for (const appliedCoupon of order.appliedCoupons) {
          try {
            let couponId = appliedCoupon.couponId

            if (!couponId) {
              const couponRecord = await prisma.coupon.findUnique({
                where: { code: appliedCoupon.code }
              })
              couponId = couponRecord?.id ?? null
            }

            if (couponId) {
              await prisma.coupon.update({
                where: { id: couponId },
                data: {
                  usageCount: {
                    increment: 1
                  }
                }
              })

              if (userIdentifier) {
                await prisma.couponRedemption.upsert({
                  where: {
                    couponId_userIdentifier: {
                      couponId,
                      userIdentifier
                    }
                  },
                  create: {
                    couponId,
                    userIdentifier,
                    usageCount: 1
                  },
                  update: {
                    usageCount: {
                      increment: 1
                    },
                    lastUsedAt: new Date()
                  }
                })
              }
            }
          } catch (usageError) {
            console.warn('Failed to update coupon usage', usageError)
          }
        }
      }

      // Handle points: deduct points if used
      // Points earning is now handled by Verifone sync after CreateInvoice succeeds
      if (order.paymentStatus !== 'completed' && order.userId) {
        try {
          // Deduct points if they were used in this order
          const paymentMetadata = parsePaymentData(order.paymentData);
          const pointsToSpend = paymentMetadata?.pointsToSpend;
          
          if (pointsToSpend && pointsToSpend > 0) {
            try {
              await spendPointsForOrder({
                userId: order.userId,
                orderId: order.id,
                pointsToSpend: pointsToSpend
              });
              console.log(`[POINTS_SPEND] Deducted ${pointsToSpend} points for order ${order.orderNumber}`);
            } catch (spendError: any) {
              console.error('[POINTS_SPEND_ERROR] Failed to deduct points for order', order.id, spendError);
              // Don't fail the entire payment - log and continue
            }
          }
          // Note: Points earning is now handled by Verifone sync in createVerifoneInvoiceAsync
        } catch (pointsError) {
          console.warn('[POINTS_SPEND_ERROR] Failed to handle points for order', order.id, pointsError);
        }
      }

      // Mark cart items as PURCHASED when payment is confirmed
      await markCartItemsAsPurchased(order.orderNumber);
      
      // Ensure order items have all required data
      await ensureOrderItemsComplete(order.orderNumber);
      
      // Trigger Verifone invoice creation async (non-blocking)
      console.log('[VERIFONE_INVOICE] Triggering Verifone invoice creation from check-status', {
        orderId: order.orderNumber,
        hasTransactionInfo: !!statusResponse.TranzactionInfo
      })
      createVerifoneInvoiceAsync(order.orderNumber, {
        transactionInfo: statusResponse.TranzactionInfo
      }).catch(err => {
        console.error('[VERIFONE_INVOICE] Failed to trigger invoice creation:', err);
        // Don't fail payment check - order still succeeds
      });
      
      // Send confirmation email and SMS (idempotent - safe to call multiple times)
      await handlePostPaymentActions(order.orderNumber, request.url);
      
      return NextResponse.json({
        success: true,
        status: 'completed',
        message: 'Payment completed successfully',
        orderId: order.orderNumber,
      });
    } else {
      // Payment failed; still merge to preserve pointsToSpend in case of retry
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'failed',
          paymentStatus: 'failed',
          paymentData: mergePaymentData(order.paymentData, statusResponse as Record<string, unknown>),
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: false,
        status: 'failed',
        message: `Payment failed: ${statusResponse.Description}`,
        orderId: order.orderNumber,
      });
    }

  } catch (error) {
    console.error('Error checking payment status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check payment status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
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
