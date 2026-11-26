/**
 * Resend order confirmation email for an existing order.
 * Uses the same flow as the Cardcom webhook: loads order by orderNumber,
 * builds email from order + checkout, and sends via Resend.
 *
 * Three independent emails are sent, one per recipient:
 * - the customer (order.customerEmail)
 * - info@sako-or.com (shop copy of the customer confirmation)
 * - moshe@sako-or.com (team order notification)
 *
 * The SMS leg is idempotent and will be skipped for an order already marked as
 * processed in InforU, so this is safe to run on a paid order.
 *
 * Note: an order whose emailSentAt is already set is skipped. Clear it first
 * with scripts/fix-order-email.ts when you need to force a resend.
 *
 * Usage:
 *   npx tsx scripts/resend-order-email.ts ORDER-1769803898865
 *   npm run resend-order-email -- ORDER-1769803898865
 */

import { config as loadEnv } from 'dotenv';

// Must run before lib/post-payment-actions pulls in lib/prisma, which reads
// DATABASE_URL at module load. Without this the script talks to localhost.
loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });

const orderNumber = process.argv[2];

if (!orderNumber) {
  console.error('Usage: npx tsx scripts/resend-order-email.ts <orderNumber>');
  console.error('Example: npx tsx scripts/resend-order-email.ts ORDER-1769803898865');
  process.exit(1);
}

async function main() {
  const { handlePostPaymentActions } = await import('../lib/post-payment-actions');
  await handlePostPaymentActions(orderNumber, '');
  console.log(`[resend-order-email] Post-payment actions completed for ${orderNumber}`);
}

main()
  .then(async () => {
    const { prisma } = await import('../lib/prisma');
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(`[resend-order-email] Failed for ${orderNumber}:`, err);
    const { prisma } = await import('../lib/prisma');
    await prisma.$disconnect();
    process.exit(1);
  });
