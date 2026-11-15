import 'server-only'

import { prisma } from './prisma'
import {
  buildCreateInvoiceEnvelope,
  callVerifoneCreateInvoice,
  InvoiceTotalsMismatchError,
  resolveOrderLevelDiscount,
  type InvoiceOrderItem,
  type InvoiceTransactionInfo
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

export type OrderRecordForInvoice = {
  id: string
  orderNumber: string
  total: number
  customerName: string | null
  createdAt: Date
  deliveryFee: number
  bogoDiscountAmount?: number | null
  orderItems: InvoiceOrderItem[]
  appliedCoupons: Array<{ discountAmount: number }>
  user: { verifoneCustomerNo: string | null } | null
}

/**
 * Build the CreateInvoice envelope for a loaded order.
 *
 * Coupons, BOGO and points are all handled by `buildDocumentLines`, which spreads
 * the recorded order-level discount across every product line in agorot so the
 * lines, the header and the charged amount reconcile exactly. It throws an
 * `InvoiceTotalsMismatchError` rather than returning an unsendable document.
 */
export function buildInvoiceEnvelopeForOrder(
  order: OrderRecordForInvoice,
  transactionInfo: InvoiceTransactionInfo,
  pointsUsed: number
): string {
  return buildCreateInvoiceEnvelope(
    {
      id: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      customerName: order.customerName,
      createdAt: order.createdAt,
      deliveryFee: order.deliveryFee || 0,
      orderItems: order.orderItems,
      appliedCoupons: order.appliedCoupons ?? [],
      bogoDiscountAmount: order.bogoDiscountAmount ?? null,
      user: order.user
    },
    transactionInfo,
    pointsUsed
  )
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
    transactionInfo?: InvoiceTransactionInfo & { Last4Digits?: string }
  },
  options: {
    /**
     * Re-attempt an order whose previous attempt failed. Never bypasses the
     * "already invoiced" guard below, so this can't produce a duplicate invoice.
     */
    force?: boolean
  } = {}
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

    // Duplicate guard: an order that already carries an invoice number (or is
    // marked successful) must never be sent again, not even with `force`.
    if (order.verifoneInvoiceNo || order.verifoneInvoiceStatus === 'success') {
      console.log(
        `[VERIFONE_INVOICE] Order ${orderId} is already invoiced (invoiceNo: ${order.verifoneInvoiceNo ?? 'unknown'}), skipping`
      )
      return
    }

    // Idempotency check: if already attempted, skip unless this is an explicit retry
    if (order.verifoneInvoiceAttemptedAt && !options.force) {
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
        verifoneInvoiceAttemptedAt: new Date(),
        // Clear the previous attempt's diagnostics so a retry can't be read as
        // still carrying the old failure.
        verifoneInvoiceError: null,
        verifoneInvoiceRequest: null,
        verifoneInvoiceResponse: null
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
      // Debug: log input context before build
      const hasChainId = Boolean(process.env.VERIFON_CHAIN_ID)
      const hasUserName = Boolean(process.env.VERIFON_USER_NAME)
      const hasPassword = Boolean(process.env.VERIFON_PASSWORD)
      console.log('[VERIFONE_INVOICE] Building envelope', {
        orderId,
        orderItemsCount: order.orderItems?.length ?? 0,
        couponsCount: order.appliedCoupons?.length ?? 0,
        hasUser: Boolean(order.user),
        hasVerifoneCredentials: hasChainId && hasUserName && hasPassword,
        credentialsDetail: { hasChainId, hasUserName, hasPassword }
      })

      console.log('[VERIFONE_INVOICE] Invoice inputs', {
        orderId,
        orderTotal: order.total,
        deliveryFee: order.deliveryFee || 0,
        pointsUsed,
        orderLevelDiscount: resolveOrderLevelDiscount(order),
        recordedDiscountTotal: order.discountTotal,
        recordedSubtotal: order.subtotal
      })

      soapEnvelope = buildInvoiceEnvelopeForOrder(order, transactionInfo, pointsUsed)
    } catch (buildError) {
      const isTotalsMismatch = buildError instanceof InvoiceTotalsMismatchError
      const errorMessage =
        buildError instanceof Error ? buildError.message : 'Failed to build SOAP envelope'
      console.error(`[VERIFONE_INVOICE] Failed to build envelope for order ${orderId}:`, errorMessage)
      // Debug: full error and stack
      console.error('[VERIFONE_INVOICE] Debug - full error:', buildError)
      if (buildError instanceof Error && buildError.stack) {
        console.error('[VERIFONE_INVOICE] Debug - stack:', buildError.stack)
      }
      if (!isTotalsMismatch) {
        console.error('[VERIFONE_INVOICE] Debug - credentials present:', {
          VERIFON_CHAIN_ID: Boolean(process.env.VERIFON_CHAIN_ID),
          VERIFON_USER_NAME: Boolean(process.env.VERIFON_USER_NAME),
          VERIFON_PASSWORD: Boolean(process.env.VERIFON_PASSWORD)
        })
      }

      // Persist why nothing was sent, so a failed order is recoverable from its
      // own record instead of only from the logs.
      await prisma.order.update({
        where: { orderNumber: orderId },
        data: {
          verifoneInvoiceStatus: 'failed',
          verifoneInvoiceError: isTotalsMismatch
            ? `Totals mismatch, request not sent: ${errorMessage}`
            : errorMessage,
          verifoneInvoiceResponse: JSON.stringify({
            success: false,
            sentToVerifone: false,
            error: errorMessage,
            ...(isTotalsMismatch
              ? {
                  code: (buildError as InvoiceTotalsMismatchError).code,
                  diagnostics: (buildError as InvoiceTotalsMismatchError).diagnostics
                }
              : {})
          })
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
