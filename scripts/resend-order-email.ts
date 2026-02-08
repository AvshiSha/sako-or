/**
 * Resend order confirmation email for an existing order.
 * Uses the same flow as the Cardcom webhook: loads order by orderNumber,
 * builds email from order + checkout, and sends via Resend.
 *
 * The confirmation email is sent to:
 * - The customer (order.customerEmail)
 * - avshi@sako-or.com (CC on customer confirmation)
 *
 * Usage:
 *   npx tsx scripts/resend-order-email.ts ORDER-1769803898865
 *   npm run resend-order-email -- ORDER-1769803898865
 */

import { handlePostPaymentActions } from '../lib/post-payment-actions';

const orderNumber = process.argv[2];

if (!orderNumber) {
  console.error('Usage: npx tsx scripts/resend-order-email.ts <orderNumber>');
  console.error('Example: npx tsx scripts/resend-order-email.ts ORDER-1769803898865');
  process.exit(1);
}

handlePostPaymentActions(orderNumber, '')
  .then(() => {
    console.log(`[resend-order-email] Post-payment actions completed for ${orderNumber}`);
  })
  .catch((err) => {
    console.error(`[resend-order-email] Failed for ${orderNumber}:`, err);
    process.exit(1);
  });
