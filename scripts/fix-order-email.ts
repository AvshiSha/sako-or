/**
 * Correct the email address stored on a single order, for guest orders where
 * there is no Firebase user to fix (see scripts/fix-user-email.ts for those).
 *
 * Clearing emailSentAt/emailMessageId is what lets the confirmation be sent
 * again afterwards: sendOrderConfirmationEmailIdempotent treats a non-null
 * emailSentAt as "already handled" and skips.
 *
 * Reads only, unless you pass --apply.
 *
 * Usage:
 *   npx tsx scripts/fix-order-email.ts ORDER-1795682631457 correct@walla.com
 *   npx tsx scripts/fix-order-email.ts ORDER-1795682631457 correct@walla.com --apply
 *
 * Then resend the confirmation:
 *   npx tsx scripts/resend-order-email.ts ORDER-1795682631457
 */

import { config as loadEnv } from 'dotenv';

// Must run before lib/prisma is imported: it reads DATABASE_URL at module load.
loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });

import { isValidEmailAddress, normalizeEmailAddress } from '../lib/email-address';

const orderNumber = process.argv[2];
const rawEmail = process.argv[3];
const apply = process.argv.includes('--apply');

if (!orderNumber || !rawEmail) {
  console.error('Usage: npx tsx scripts/fix-order-email.ts <orderNumber> <newEmail> [--apply]');
  process.exit(1);
}

const newEmail = normalizeEmailAddress(rawEmail);

if (!isValidEmailAddress(newEmail)) {
  console.error(`Refusing to store an invalid address: "${rawEmail}"`);
  process.exit(1);
}

async function main() {
  const { prisma } = await import('../lib/prisma');

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      orderNumber: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      total: true,
      status: true,
      createdAt: true,
      emailSentAt: true,
      emailMessageId: true,
    },
  });

  if (!order) {
    console.error(`Order not found: ${orderNumber}`);
    process.exit(1);
  }

  console.log('Current order state:');
  console.log(`  orderNumber:    ${order.orderNumber}`);
  console.log(`  customerName:   ${order.customerName}`);
  console.log(`  customerEmail:  ${order.customerEmail}`);
  console.log(`  customerPhone:  ${order.customerPhone}`);
  console.log(`  total:          ${order.total}`);
  console.log(`  status:         ${order.status}`);
  console.log(`  createdAt:      ${order.createdAt.toISOString()}`);
  console.log(`  emailSentAt:    ${order.emailSentAt ? order.emailSentAt.toISOString() : 'null'}`);
  console.log(`  emailMessageId: ${order.emailMessageId ?? 'null'}`);
  console.log('');

  if (order.customerEmail === newEmail && !order.emailSentAt) {
    console.log('Nothing to change: address already correct and no send recorded.');
    return;
  }

  console.log('Planned change:');
  console.log(`  customerEmail:  ${order.customerEmail}  ->  ${newEmail}`);
  console.log(`  emailSentAt:    ${order.emailSentAt ? order.emailSentAt.toISOString() : 'null'}  ->  null`);
  console.log(`  emailMessageId: ${order.emailMessageId ?? 'null'}  ->  null`);
  console.log('');

  if (!apply) {
    console.log('Dry run. Re-run with --apply to write these changes.');
    return;
  }

  const updated = await prisma.order.update({
    where: { orderNumber },
    data: { customerEmail: newEmail, emailSentAt: null, emailMessageId: null },
    select: { customerEmail: true, emailSentAt: true, emailMessageId: true },
  });

  console.log('Applied. Order now reads:');
  console.log(`  customerEmail:  ${updated.customerEmail}`);
  console.log(`  emailSentAt:    ${updated.emailSentAt ? updated.emailSentAt.toISOString() : 'null'}`);
  console.log(`  emailMessageId: ${updated.emailMessageId ?? 'null'}`);
  console.log('');
  console.log(`Next: npx tsx scripts/resend-order-email.ts ${orderNumber}`);
}

main()
  .then(async () => {
    const { prisma } = await import('../lib/prisma');
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error('Failed:', err);
    const { prisma } = await import('../lib/prisma');
    await prisma.$disconnect();
    process.exit(1);
  });
