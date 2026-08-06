import 'dotenv/config'
import { createScriptPrisma } from './script-prisma'
import { buildReviewUrl } from '../lib/server/review-token'

/**
 * Generates a signed review link for an order, so the review page can be opened
 * locally without waiting 24h for the cron to send one.
 *
 * Usage:
 *   npm run review-link                    # list recent orders to choose from
 *   npm run review-link -- ORDER-123       # print the Hebrew + English links
 *   npm run review-link -- ORDER-123 --reset   # delete its review, to re-test the form
 *
 * Read-only unless --reset is passed.
 */

const prisma = createScriptPrisma()

async function listRecentOrders() {
  const orders = await prisma.order.findMany({
    where: { orderItems: { some: {} } },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: {
      orderNumber: true,
      customerName: true,
      createdAt: true,
      _count: { select: { orderItems: true } },
      review: { select: { id: true } },
    },
  })

  if (orders.length === 0) {
    console.log('No orders with items found.')
    return
  }

  console.log('\nRecent orders with items:\n')
  for (const order of orders) {
    const reviewed = order.review ? '  [already reviewed]' : ''
    const date = order.createdAt.toISOString().slice(0, 10)
    console.log(
      `  ${order.orderNumber.padEnd(30)} ${String(order._count.orderItems).padStart(2)} item(s)  ${date}  ${order.customerName ?? ''}${reviewed}`
    )
  }
  console.log('\nThen: npm run review-link -- <orderNumber>\n')
}

async function printLink(orderNumber: string, reset: boolean) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      orderItems: { select: { productName: true, size: true, colorName: true } },
      review: { select: { id: true, submittedAt: true } },
    },
  })

  if (!order) {
    console.error(`\nOrder not found: ${orderNumber}\n`)
    process.exitCode = 1
    return
  }

  if (reset && order.review) {
    await prisma.review.delete({ where: { id: order.review.id } })
    console.log(`\nDeleted existing review for ${order.orderNumber} (submitted ${order.review.submittedAt.toISOString()})`)
    order.review = null
  }

  console.log(`\nOrder:    ${order.orderNumber}`)
  console.log(`Customer: ${order.customerName ?? '(none)'}`)
  console.log(`Items:    ${order.orderItems.length}`)
  for (const item of order.orderItems) {
    const parts = [item.productName, item.size, item.colorName].filter(Boolean)
    console.log(`            - ${parts.join(' · ')}`)
  }

  if (order.orderItems.length === 0) {
    console.log('\n  NOTE: this order has no items, so the form will render empty.')
  }

  if (order.review) {
    console.log(
      '\n  NOTE: this order already has a review, so the page will show the' +
        '\n        "already reviewed" state. Re-run with --reset to clear it.'
    )
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.APP_BASE_URL ?? ''
  console.log('\nHebrew:')
  console.log(`  ${buildReviewUrl({ orderNumber: order.orderNumber, language: 'he' })}`)
  console.log('\nEnglish:')
  console.log(`  ${buildReviewUrl({ orderNumber: order.orderNumber, language: 'en' })}`)

  if (base && !base.includes('localhost')) {
    console.log(
      `\n  Links point at ${base}. To open them against a local dev server,` +
        '\n  swap the origin for http://localhost:3000.'
    )
  }
  console.log('')
}

async function main() {
  if (!process.env.REVIEW_TOKEN_SECRET) {
    console.error('\nREVIEW_TOKEN_SECRET is not set — add it to .env first.\n')
    process.exitCode = 1
    return
  }

  const args = process.argv.slice(2)
  const orderNumber = args.find((arg) => !arg.startsWith('--'))
  const reset = args.includes('--reset')

  if (!orderNumber) {
    await listRecentOrders()
    return
  }

  await printLink(orderNumber, reset)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
