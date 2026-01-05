import { NextRequest, NextResponse } from 'next/server';
import { CardComAPI } from '../../../../lib/cardcom';
import { prisma } from '../../../../lib/prisma';
import { stringifyPaymentData } from '../../../../lib/orders';
import { awardPointsForOrder } from '../../../../lib/points';

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json().catch(() => ({}));

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

    if (!order.cardcomLowProfileId) {
      return NextResponse.json(
        { error: 'No CardCom Low Profile ID found for this order' },
        { status: 400 }
      );
    }

    // Check payment status with CardCom
    const cardcomAPI = new CardComAPI();
    const statusResponse = await cardcomAPI.getLowProfileStatus(order.cardcomLowProfileId);

    console.log('CardCom status response:', statusResponse);

    // Update order status based on CardCom response
    if (statusResponse.ResponseCode === 0) {
      // Payment successful
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'completed',
          paymentStatus: 'completed',
          cardcomTransactionId: statusResponse.TranzactionId,
          paymentData: stringifyPaymentData(statusResponse),
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

      // Award points once, after payment is completed (idempotent by DB uniqueness).
      // `Order.total` is already the final total after discounts/points, so we award based on that.
      if (order.paymentStatus !== 'completed') {
        try {
          await awardPointsForOrder(order.id);
        } catch (pointsError) {
          console.warn('[POINTS_AWARD_ERROR] Failed to award points for order', order.id, pointsError);
        }
      }

      return NextResponse.json({
        success: true,
        status: 'completed',
        message: 'Payment completed successfully',
        orderId: order.orderNumber,
      });
    } else {
      // Payment failed
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'failed',
          paymentStatus: 'failed',
          paymentData: stringifyPaymentData(statusResponse),
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
