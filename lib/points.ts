import { prisma } from './prisma';
import { PointsKind } from '@prisma/client';

function roundPoints(value: number): number {
  // Calculate 5% of order total, rounded to 2 decimal places.
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

  return prisma.$transaction(async (tx) => {
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
    const newPointsEarned = roundPoints(
      roundedPointsAfter - roundedPointsBefore + roundedPointsUsed
    );

    // Only create EARN entry if points were earned
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
        newPointsEarned,
        pointsBalanceSetTo: roundedPointsAfter
      }
    );

    return pointsRow;
  });
}


