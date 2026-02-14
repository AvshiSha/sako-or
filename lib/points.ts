import { prisma } from './prisma';
import { PointsKind, Prisma } from '@prisma/client';
import { getVerifoneCustomerByCellular } from './verifone';

function roundPoints(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function spendPointsForOrder(params: {
  userId: string;
  orderId: string;
  pointsToSpend: number;
}) {
  const pointsToSpend = roundPoints(params.pointsToSpend);
  if (!Number.isFinite(pointsToSpend) || pointsToSpend <= 0) {
    throw new Error('pointsToSpend must be a positive number');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.points.findUnique({
        where: {
          orderId_kind: { orderId: params.orderId, kind: PointsKind.SPEND }
        }
      });
      if (existing) return existing;

      const updated = await tx.user.updateMany({
        where: {
          id: params.userId,
          pointsBalance: { gte: pointsToSpend }
        },
        data: { pointsBalance: { decrement: pointsToSpend } }
      });

      if (updated.count !== 1) {
        throw new Error('Insufficient points balance');
      }

      const order = await tx.order.findUnique({
        where: { id: params.orderId },
        select: { orderNumber: true }
      });

      return tx.points.create({
        data: {
          userId: params.userId,
          orderId: params.orderId,
          kind: PointsKind.SPEND,
          delta: -pointsToSpend,
          reason: `Used points in order ${order?.orderNumber ?? 'unknown'}`
        }
      });
    });
  } catch (err) {
    // Handle concurrent calls that race on the unique (orderId, kind) constraint.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const existing = await prisma.points.findUnique({
        where: {
          orderId_kind: { orderId: params.orderId, kind: PointsKind.SPEND }
        }
      });
      if (existing) {
        return existing;
      }
    }
    throw err;
  }
}

export async function awardPointsForOrder(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.points.findUnique({
      where: { orderId_kind: { orderId, kind: PointsKind.EARN } }
    });
    if (existing) return existing;

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        currency: true,
        userId: true,
        orderItems: {
          select: {
            price: true,
            salePrice: true,
            quantity: true
          }
        }
      }
    });

    if (!order) throw new Error('Order not found');
    if (!order.userId) {
      // Guest checkout: no user to award to.
      return null;
    }

    // Calculate points based on sum of product prices (using sale price if available)
    // For each item: (salePrice || price) * quantity
    const itemsTotal = order.orderItems.reduce((sum, item) => {
      const itemPrice = item.salePrice ?? item.price;
      return sum + (itemPrice * item.quantity);
    }, 0);

    const earnedPoints = roundPoints(itemsTotal * 0.05);

    const pointsRow = await tx.points.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        kind: PointsKind.EARN,
        delta: earnedPoints,
        reason: `Points earned from order ${order.orderNumber}`
      }
    });

    // Keep stored balance in sync for fast reads.
    if (earnedPoints !== 0) {
      await tx.user.update({
        where: { id: order.userId },
        data: { pointsBalance: { increment: earnedPoints } }
      });
    }

    return pointsRow;
  });
}

/**
 * Sync points from Verifone after CreateInvoice succeeds
 * Updates user's pointsBalance directly from Verifone's CreditPoints value
 * and creates a ledger entry for the points earned
 */
export async function syncPointsFromVerifone(params: {
  orderId: string;
  userId: string;
  pointsBefore: number;
  pointsAfter: number;
  pointsUsed: number;
}) {
  const { orderId, userId, pointsBefore, pointsAfter, pointsUsed } = params;

  // Round all values to 2 decimal places
  const roundedPointsBefore = roundPoints(pointsBefore);
  const roundedPointsAfter = roundPoints(pointsAfter);
  const roundedPointsUsed = roundPoints(pointsUsed);

  return prisma.$transaction(async (tx) => {
    // Idempotency check: if EARN entry already exists for this order, skip
    const existing = await tx.points.findUnique({
      where: {
        orderId_kind: { orderId, kind: PointsKind.EARN }
      }
    });
    if (existing) {
      console.log(
        `[POINTS_SYNC] Points already synced for order ${orderId}, skipping`
      );
      return existing;
    }

    // Get order for logging
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true }
    });

    // Calculate new points earned for ledger entry
    // Formula: (Verifone points after) - (Verifone points before) + (points used)
    const rawNewPointsEarned = roundPoints(
      roundedPointsAfter - roundedPointsBefore + roundedPointsUsed
    );

    // Clamp to 0 for "points earned" shown/stored for this order.
    // If Verifone reduced the customer's points (expiry/manual adjustment),
    // rawNewPointsEarned can be negative, but the user should not see
    // "negative earned points" for a purchase.
    const newPointsEarned = Math.max(0, rawNewPointsEarned);

    // Only create EARN entry if points were earned (strictly positive)
    let pointsRow = null;
    if (newPointsEarned > 0) {
      pointsRow = await tx.points.create({
        data: {
          userId,
          orderId,
          kind: PointsKind.EARN,
          delta: newPointsEarned,
          reason: `Points earned from order ${order?.orderNumber ?? 'unknown'} (synced from Verifone)`
        }
      });
    }

    // Update user's pointsBalance directly to Verifone's CreditPoints value (after purchase)
    // This ensures the balance matches Verifone as the source of truth
    await tx.user.update({
      where: { id: userId },
      data: { pointsBalance: roundedPointsAfter }
    });

    console.log(
      `[POINTS_SYNC] Synced points from Verifone for order ${order?.orderNumber ?? orderId}`,
      {
        pointsBefore: roundedPointsBefore,
        pointsAfter: roundedPointsAfter,
        pointsUsed: roundedPointsUsed,
        newPointsEarnedRaw: rawNewPointsEarned,
        newPointsEarned,
        pointsBalanceSetTo: roundedPointsAfter
      }
    );

    return pointsRow;
  });
}

export type VerifonePointsSyncError = {
  userId?: string;
  phone?: string | null;
  error: string;
  status?: number;
  statusDescription?: string;
};

export type VerifonePointsSyncSummary = {
  totalProcessed: number;
  updated: number;
  skipped: number;
  failed: number;
  durationMs: number;
  errors: VerifonePointsSyncError[];
};

type SyncAllUserPointsOptions = {
  batchSize?: number;
  maxBatchesPerRun?: number;
  concurrency?: number;
};

/**
 * Batch cron-sync of all users' pointsBalance from Verifone CreditPoints.
 *
 * - Verifone is treated as the source of truth for points.
 * - Points are rounded to 2 decimal places.
 * - Only writes to DB when the balance actually changes (idempotent).
 * - Handles per-user failures without aborting the whole job.
 */
export async function syncAllUserPointsFromVerifone(
  options: SyncAllUserPointsOptions = {}
): Promise<VerifonePointsSyncSummary> {
  const batchSize = options.batchSize && options.batchSize > 0 ? options.batchSize : 100;
  const maxBatchesPerRun =
    options.maxBatchesPerRun && options.maxBatchesPerRun > 0
      ? options.maxBatchesPerRun
      : 50;
  const concurrency =
    options.concurrency !== undefined && options.concurrency > 0
      ? options.concurrency
      : 1;

  const startTime = Date.now();

  let totalProcessed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: VerifonePointsSyncError[] = [];

  let lastUserId: string | null = null;

  console.log('[CRON_POINTS_SYNC] Starting Verifone points sync', {
    batchSize,
    maxBatchesPerRun,
    concurrency
  });

  for (let batchIndex = 0; batchIndex < maxBatchesPerRun; batchIndex++) {
    const users: {
      id: string;
      phone: string | null;
      pointsBalance: Prisma.Decimal | null;
    }[] = await prisma.user.findMany({
      where: {
        phone: { not: null },
        signupCompletedAt: { not: null },
        isDelete: false
      },
      select: {
        id: true,
        phone: true,
        pointsBalance: true
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(lastUserId
        ? {
            skip: 1,
            cursor: { id: lastUserId }
          }
        : {})
    });

    if (users.length === 0) {
      break;
    }

    lastUserId = users[users.length - 1]!.id;

    let index = 0;
    while (index < users.length) {
      const chunk = users.slice(index, index + concurrency);
      index += concurrency;

      await Promise.all(
        chunk.map(async (user) => {
          totalProcessed += 1;

          try {
            const phone = user.phone;
            if (!phone) {
              skipped += 1;
              console.log(
                '[CRON_POINTS_SYNC_USER] Skipping user without phone',
                { userId: user.id }
              );
              return;
            }

            const verifoneResult = await getVerifoneCustomerByCellular(phone);

            if (!verifoneResult.success) {
              failed += 1;
              const errorSummary: VerifonePointsSyncError = {
                userId: user.id,
                phone,
                error:
                  verifoneResult.statusDescription ||
                  'Verifone GetCustomers call failed',
                status: verifoneResult.status,
                statusDescription: verifoneResult.statusDescription
              };
              errors.push(errorSummary);
              console.error(
                '[CRON_POINTS_SYNC_ERROR] Verifone lookup failed for user',
                errorSummary
              );
              return;
            }

            const customer = verifoneResult.customer;
            if (!customer || !customer.isClubMember) {
              skipped += 1;
              console.log(
                '[CRON_POINTS_SYNC_USER] Skipping - no Verifone club customer',
                {
                  userId: user.id,
                  phone,
                  hasCustomer: !!customer,
                  status: verifoneResult.status,
                  statusDescription: verifoneResult.statusDescription
                }
              );
              return;
            }

            const verifonePoints = roundPoints(
              Math.max(0, customer.creditPoints || 0)
            );
            const currentBalance = roundPoints(
              Number(user.pointsBalance ?? 0)
            );

            if (verifonePoints === currentBalance) {
              skipped += 1;
              return;
            }

            await prisma.user.update({
              where: { id: user.id },
              data: { pointsBalance: verifonePoints }
            });

            updated += 1;

            console.log('[CRON_POINTS_SYNC_USER] Updated points for user', {
              userId: user.id,
              phone,
              previousBalance: currentBalance,
              newBalance: verifonePoints
            });
          } catch (err) {
            failed += 1;
            const message =
              err instanceof Error ? err.message : String(err ?? 'Unknown error');
            const errorSummary: VerifonePointsSyncError = {
              userId: user.id,
              phone: user.phone,
              error: message
            };
            errors.push(errorSummary);
            console.error(
              '[CRON_POINTS_SYNC_ERROR] Unexpected error while syncing user',
              {
                ...errorSummary,
                rawError: err
              }
            );
          }
        })
      );
    }

    if (users.length < batchSize) {
      // No more users to process.
      break;
    }
  }

  const durationMs = Date.now() - startTime;

  const summary: VerifonePointsSyncSummary = {
    totalProcessed,
    updated,
    skipped,
    failed,
    durationMs,
    errors
  };

  console.log('[CRON_POINTS_SYNC] Completed Verifone points sync', summary);

  return summary;
}

