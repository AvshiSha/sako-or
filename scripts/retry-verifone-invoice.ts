/**
 * Inspect, and optionally re-send, the Verifone invoice for one order.
 *
 * Why this exists: a Verifone invoice can fail after the customer has already
 * been charged and emailed (CardCom took the money, Verifone refused the
 * document). The order then carries `verifoneInvoiceStatus: 'failed'` and no
 * invoice number, and nothing else retries it.
 *
 * What it does NOT do: it never touches the payment, never sends a confirmation
 * email or SMS, and refuses outright if the order already has an invoice number
 * or a 'success' status, so it cannot charge twice, duplicate an invoice, or
 * re-notify the customer.
 *
 * Usage:
 *   npm run verifone:invoice -- ORDER-1794766845298            # dry run (default)
 *   npm run verifone:invoice -- ORDER-1794766845298 --send     # actually create the invoice
 */

import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

async function main() {
  const orderNumber = process.argv[2]
  const send = process.argv.includes('--send')

  if (!orderNumber || orderNumber.startsWith('--')) {
    console.error('Usage: npx tsx scripts/retry-verifone-invoice.ts <orderNumber> [--send]')
    process.exit(1)
  }

  // Imported here so the env above is in place before Prisma/Verifone read it.
  const { prisma } = await import('../lib/prisma')
  const { parsePaymentData } = await import('../lib/orders')
  const { buildInvoiceEnvelopeForOrder, createVerifoneInvoiceAsync } = await import(
    '../lib/verifone-invoice-job'
  )
  const {
    InvoiceTotalsMismatchError,
    buildDocumentLines,
    calculateInvoiceTotals,
    resolveOrderLevelDiscount
  } = await import('../lib/verifone-invoice')

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      orderItems: true,
      appliedCoupons: true,
      user: { select: { verifoneCustomerNo: true, phone: true } }
    }
  })

  if (!order) {
    console.error(`Order not found: ${orderNumber}`)
    process.exit(1)
  }

  const paymentData = parsePaymentData(order.paymentData)
  const transactionInfo = (paymentData?.transactionInfo ?? {}) as Record<string, unknown> & {
    Amount?: number
  }
  const pointsUsed = paymentData?.pointsToSpend || 0
  const orderLevelDiscount = resolveOrderLevelDiscount(order)

  console.log('--- order ---')
  console.log({
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: order.total,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    deliveryFee: order.deliveryFee,
    bogoDiscountAmount: order.bogoDiscountAmount,
    pointsUsed,
    orderLevelDiscount,
    verifiedPaymentAmount: transactionInfo.Amount ?? null,
    verifoneInvoiceStatus: order.verifoneInvoiceStatus,
    verifoneInvoiceNo: order.verifoneInvoiceNo,
    verifoneInvoiceAttemptedAt: order.verifoneInvoiceAttemptedAt,
    verifoneInvoiceError: order.verifoneInvoiceError
  })

  if (order.verifoneInvoiceNo || order.verifoneInvoiceStatus === 'success') {
    console.log(
      `\nAlready invoiced (invoiceNo: ${order.verifoneInvoiceNo ?? 'unknown'}). Refusing to send again.`
    )
    await prisma.$disconnect()
    return
  }

  if (order.paymentStatus !== 'completed') {
    console.log(
      `\nPayment status is "${order.paymentStatus}", not "completed". Refusing to invoice an unpaid order.`
    )
    await prisma.$disconnect()
    return
  }

  // Reconciliation preview - the same arithmetic the real call uses.
  console.log('\n--- document lines ---')
  try {
    const lines = buildDocumentLines({
      orderItems: order.orderItems,
      orderLevelDiscount,
      pointsUsed,
      deliveryFee: order.deliveryFee || 0,
      orderTotal: order.total,
      orderNumber: order.orderNumber
    })
    const totals = calculateInvoiceTotals(lines, order.total)
    for (const line of lines) {
      console.log(
        `  ${String(line.LineNo).padStart(2)}  ${line.ItemID.padEnd(16)} ${String(line.UnitPrice).padStart(9)} x ${String(line.Qty).padStart(3)} = ${String(line.TotalPrice).padStart(9)}`
      )
    }
    const sumLines = Math.round(lines.reduce((sum, line) => sum + line.TotalPrice, 0) * 100) / 100
    console.log('\n--- totals ---')
    console.log({
      sumLinesWithVAT: sumLines,
      headerNetPlusVAT:
        Math.round((totals.TotalAfterDiscount_WithoutVAT + totals.VAT) * 100) / 100,
      TotalPriceIncludeVAT: totals.TotalPriceIncludeVAT,
      TotalItems: totals.TotalItems,
      TotalLines: totals.TotalLines,
      reconciles: sumLines === totals.TotalPriceIncludeVAT
    })

    // Build the full envelope too, so the dry run exercises every gate.
    const envelope = buildInvoiceEnvelopeForOrder(order, transactionInfo, pointsUsed)
    console.log(`\nEnvelope built OK (${envelope.length} bytes).`)
  } catch (error) {
    if (error instanceof InvoiceTotalsMismatchError) {
      console.error('\nThis order does NOT reconcile - nothing would be sent:')
      console.error(error.message)
      console.error(error.diagnostics)
      await prisma.$disconnect()
      process.exit(2)
    }
    throw error
  }

  if (!send) {
    console.log('\nDry run. Re-run with --send to create the invoice in Verifone.')
    await prisma.$disconnect()
    return
  }

  console.log('\nSending CreateInvoice to Verifone...')
  await createVerifoneInvoiceAsync(orderNumber, { transactionInfo }, { force: true })

  const after = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      verifoneInvoiceStatus: true,
      verifoneInvoiceNo: true,
      verifoneInvoiceError: true,
      verifoneInvoiceSyncedAt: true
    }
  })
  console.log('\n--- result ---')
  console.log(after)
  await prisma.$disconnect()
}

main().catch(async error => {
  console.error(error)
  process.exit(1)
})
