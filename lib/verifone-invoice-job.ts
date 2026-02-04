import 'server-only'

import { prisma } from './prisma'
import {
  buildCreateInvoiceEnvelope,
  callVerifoneCreateInvoice
} from './verifone-invoice'
import { parsePaymentData } from './orders'
import { getVerifoneCustomerByCellular } from './verifone'
import { syncPointsFromVerifone } from './points'

/**
 * Round points value to 2 decimal places
 */
function roundPoints(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Create Verifone invoice asynchronously after successful CardCom payment
 * This function is idempotent and handles errors gracefully
 * 
 * @param orderId - The order number (orderNumber field)
 * @param cardcomTransactionData - CardCom transaction info from webhook
 */
export async function createVerifoneInvoiceAsync(
  orderId: string,
  cardcomTransactionData: {
    transactionInfo?: {
      FirstPaymentAmount?: number
      ConstPaymentAmount?: number
      NumberOfPayments?: number
      Last4CardDigitsString?: string
      CardMonth?: string
      CardYear?: string
      ApprovalNumber?: string
      CardOwnerIdentityNumber?: string
      Brand?: string
      Last4Digits?: string
    }
  }
): Promise<void> {
  try {
    // Fetch order with all required relations
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderId },
      include: {
        orderItems: true,
        appliedCoupons: true,
        user: {
          select: {
            verifoneCustomerNo: true,
            phone: true
          }
        }
      }
    })

    if (!order) {
      console.error(`[VERIFONE_INVOICE] Order not found: ${orderId}`)
      return
    }

    // Idempotency check: if already attempted, skip
    if (order.verifoneInvoiceAttemptedAt) {
      console.log(
        `[VERIFONE_INVOICE] Invoice already attempted for order ${orderId}, skipping`
      )
      return
    }

    // Mark as attempted immediately to prevent duplicate calls
    await prisma.order.update({
      where: { orderNumber: orderId },
      data: {
        verifoneInvoiceStatus: 'pending',
        verifoneInvoiceAttemptedAt: new Date()
      }
    })

    console.log(`[VERIFONE_INVOICE] Starting invoice creation for order ${orderId}`)

    // Debug: Log orderItems from database
    console.log(`[VERIFONE_INVOICE] OrderItems from database:`, 
      order.orderItems.map((item, idx) => ({
        index: idx,
        id: item.id,
        productSku: item.productSku,
        price: item.price,
        salePrice: item.salePrice,
        quantity: item.quantity,
        colorName: item.colorName,
        size: item.size
      }))
    )

    // Extract points used from payment data
    const paymentData = parsePaymentData(order.paymentData)
    const pointsUsed = paymentData?.pointsToSpend || 0

    // Get user phone for GetCustomers call (priority: user.phone > order.customerPhone)
    const userPhone = order.user?.phone || order.customerPhone

    // Get points balance BEFORE CreateInvoice (if user exists)
    let pointsBefore = 0
    if (order.userId && userPhone) {
      try {
        const verifoneResultBefore = await getVerifoneCustomerByCellular(userPhone)
        if (
          verifoneResultBefore.success &&
          verifoneResultBefore.customer &&
          verifoneResultBefore.customer.isClubMember
        ) {
          // Round to 2 decimal places
          pointsBefore = roundPoints(Math.max(0, verifoneResultBefore.customer.creditPoints || 0))
          console.log(
            `[VERIFONE_INVOICE] Points balance before CreateInvoice for order ${orderId}:`,
            pointsBefore
          )
        }
      } catch (error) {
        console.error(
          `[VERIFONE_INVOICE] Failed to get points before CreateInvoice for order ${orderId}:`,
          error
        )
        // Continue anyway - points sync will be skipped if before value is unavailable
      }
    }

    // Get transaction info
    const transactionInfo = cardcomTransactionData.transactionInfo || {}

    // Build SOAP envelope
    let soapEnvelope: string
    try {
      // Prefer real coupons when present; otherwise, if there's a stored BOGO discount
      // use it as a single coupon-equivalent amount for the invoice.
      const hasOrderCoupons =
        Array.isArray(order.appliedCoupons) && order.appliedCoupons.length > 0
      const couponsForInvoice = hasOrderCoupons
        ? order.appliedCoupons.map(coupon => ({
            discountAmount: coupon.discountAmount
          }))
        : order.bogoDiscountAmount && order.bogoDiscountAmount > 0
          ? [{ discountAmount: order.bogoDiscountAmount }]
          : []

      soapEnvelope = buildCreateInvoiceEnvelope(
        {
          id: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          customerName: order.customerName,
          createdAt: order.createdAt,
          deliveryFee: order.deliveryFee || 0,
          orderItems: order.orderItems,
          appliedCoupons: couponsForInvoice,
          user: order.user
        },
        transactionInfo,
        pointsUsed
      )
    } catch (buildError) {
      const errorMessage =
        buildError instanceof Error ? buildError.message : 'Failed to build SOAP envelope'
      console.error(`[VERIFONE_INVOICE] Failed to build envelope for order ${orderId}:`, buildError)

      await prisma.order.update({
        where: { orderNumber: orderId },
        data: {
          verifoneInvoiceStatus: 'failed',
          verifoneInvoiceError: errorMessage
        }
      })
      return
    }

    // Store request for debugging
    await prisma.order.update({
      where: { orderNumber: orderId },
      data: {
        verifoneInvoiceRequest: JSON.stringify({ soapEnvelope })
      }
    })

    // Call Verifone API
    const result = await callVerifoneCreateInvoice(soapEnvelope)

    // Store response
    await prisma.order.update({
      where: { orderNumber: orderId },
      data: {
        verifoneInvoiceResponse: JSON.stringify({
          success: result.success,
          status: result.status,
          statusDescription: result.statusDescription,
          invoiceNo: result.invoiceNo,
          storeNo: result.storeNo,
          customerNo: result.customerNo,
          createDate: result.createDate,
          createTime: result.createTime
        })
      }
    })

    if (result.success) {
      // Success: update order with invoice details
      await prisma.order.update({
        where: { orderNumber: orderId },
        data: {
          verifoneInvoiceStatus: 'success',
          verifoneInvoiceNo: result.invoiceNo || null,
          verifoneInvoiceSyncedAt: new Date()
        }
      })

      console.log(
        `[VERIFONE_INVOICE] Invoice created successfully for order ${orderId}`,
        {
          invoiceNo: result.invoiceNo,
          storeNo: result.storeNo
        }
      )

      // Sync points from Verifone after successful invoice creation
      if (order.userId && userPhone) {
        try {
          // Get points balance AFTER CreateInvoice
          const verifoneResultAfter = await getVerifoneCustomerByCellular(userPhone)
          if (
            verifoneResultAfter.success &&
            verifoneResultAfter.customer &&
            verifoneResultAfter.customer.isClubMember
          ) {
            // Round to 2 decimal places
            const pointsAfter = roundPoints(Math.max(0, verifoneResultAfter.customer.creditPoints || 0))

            console.log(
              `[VERIFONE_INVOICE] Points balance after CreateInvoice for order ${orderId}:`,
              pointsAfter
            )

            // Sync points from Verifone
            await syncPointsFromVerifone({
              orderId: order.id,
              userId: order.userId,
              pointsBefore,
              pointsAfter,
              pointsUsed
            })

            console.log(
              `[VERIFONE_INVOICE] Points synced successfully for order ${orderId}`
            )
          } else {
            console.log(
              `[VERIFONE_INVOICE] Skipping points sync for order ${orderId} - customer not found or not a club member`
            )
          }
        } catch (pointsError) {
          // Log error but don't fail invoice creation
          console.error(
            `[VERIFONE_INVOICE] Failed to sync points for order ${orderId}:`,
            pointsError
          )
        }
      } else {
        console.log(
          `[VERIFONE_INVOICE] Skipping points sync for order ${orderId} - no user or phone`
        )
      }
    } else {
      // Failure: mark as failed but don't throw
      const errorMessage = result.statusDescription || 'Unknown error'
      await prisma.order.update({
        where: { orderNumber: orderId },
        data: {
          verifoneInvoiceStatus: 'failed',
          verifoneInvoiceError: errorMessage
        }
      })

      console.error(
        `[VERIFONE_INVOICE] Invoice creation failed for order ${orderId}:`,
        errorMessage,
        {
          status: result.status,
          statusDescription: result.statusDescription
        }
      )
    }
  } catch (error) {
    // Catch-all error handler - log but don't throw
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[VERIFONE_INVOICE] Unexpected error for order ${orderId}:`, error)

    try {
      await prisma.order.update({
        where: { orderNumber: orderId },
        data: {
          verifoneInvoiceStatus: 'failed',
          verifoneInvoiceError: errorMessage
        }
      })
    } catch (updateError) {
      console.error(
        `[VERIFONE_INVOICE] Failed to update order status after error:`,
        updateError
      )
    }
  }
}
