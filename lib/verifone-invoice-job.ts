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
 * Round to 2 decimal places
 */
function roundTwo(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Round points value to 2 decimal places
 */
function roundPoints(value: number): number {
  return roundTwo(value)
}

type OrderItemForInvoice = {
  productSku: string
  colorName: string | null
  size: string | null
  quantity: number
  price: number
  salePrice: number | null
}

/**
 * Distribute a target total across order items proportionally (same logic as create-low-profile
 * for CardCom). Returns items with price/salePrice set so that sum(price * qty) = targetProductTotal.
 */
function orderItemsWithProportionalTotals(
  orderItems: OrderItemForInvoice[],
  targetProductTotal: number
): OrderItemForInvoice[] {
  if (orderItems.length === 0) return []
  const subtotalBefore = orderItems.reduce((sum, item) => {
    const effective = (item.salePrice != null && item.salePrice > 0 && item.salePrice < item.price)
      ? item.salePrice
      : item.price
    return sum + effective * item.quantity
  }, 0)
  if (subtotalBefore <= 0) return orderItems

  const lineTotalsAfter: number[] = []
  let remaining = roundTwo(targetProductTotal)
  for (let i = 0; i < orderItems.length; i++) {
    const item = orderItems[i]
    const effective = (item.salePrice != null && item.salePrice > 0 && item.salePrice < item.price)
      ? item.salePrice
      : item.price
    const lineBefore = effective * item.quantity
    let lineAfter: number
    if (i === orderItems.length - 1) {
      lineAfter = remaining
    } else {
      lineAfter = roundTwo((lineBefore / subtotalBefore) * targetProductTotal)
      if (lineAfter > remaining) lineAfter = remaining
      remaining = roundTwo(remaining - lineAfter)
    }
    lineTotalsAfter.push(lineAfter)
  }

  return orderItems.map((item, i) => {
    const qty = item.quantity && item.quantity > 0 ? item.quantity : 1
    const discountedUnitPrice = roundTwo(lineTotalsAfter[i]! / qty)
    return {
      ...item,
      price: discountedUnitPrice,
      salePrice: null
    }
  })
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
          pointsBefore = roundPoints(Math.max(0, verifoneResultBefore.customer.creditPoints || 0))
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
      const hasOrderCoupons =
        Array.isArray(order.appliedCoupons) && order.appliedCoupons.length > 0
      const hasBogoDiscount =
        !hasOrderCoupons &&
        order.bogoDiscountAmount != null &&
        order.bogoDiscountAmount > 0

      // When BOGO was applied, pass order items with the same discounted line totals as CardCom
      // so Verifone document lines sum to order.total (no lump coupon on first line).
      const targetProductTotal = roundTwo(
        order.total - (order.deliveryFee || 0) + pointsUsed
      )
      const orderItemsForEnvelope = hasBogoDiscount
        ? orderItemsWithProportionalTotals(
            order.orderItems as OrderItemForInvoice[],
            targetProductTotal
          )
        : order.orderItems

      const couponsForInvoice = hasOrderCoupons
        ? order.appliedCoupons.map(coupon => ({
            discountAmount: coupon.discountAmount
          }))
        : []

      soapEnvelope = buildCreateInvoiceEnvelope(
        {
          id: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          customerName: order.customerName,
          createdAt: order.createdAt,
          deliveryFee: order.deliveryFee || 0,
          orderItems: orderItemsForEnvelope,
          appliedCoupons: couponsForInvoice,
          user: order.user
        },
        transactionInfo,
        pointsUsed
      )
    } catch (buildError) {
      const errorMessage =
        buildError instanceof Error ? buildError.message : 'Failed to build SOAP envelope'
      console.error(`[VERIFONE_INVOICE] Failed to build envelope for order ${orderId}:`, errorMessage)

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
            const pointsAfter = roundPoints(Math.max(0, verifoneResultAfter.customer.creditPoints || 0))

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
