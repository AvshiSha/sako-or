import { prisma } from './prisma';
import { PointsKind } from '@prisma/client';

function roundToNearestInt(value: number): number {
  // Avoid surprises from floating point by rounding to nearest int.
  return Math.round(value);
}

export async function spendPointsForOrder(params: {
  userId: string;
  orderId: string;
  pointsToSpend: number;
}) {
  const pointsToSpend = Math.trunc(params.pointsToSpend);
  if (!Number.isFinite(pointsToSpend) || pointsToSpend <= 0) {
    throw new Error('pointsToSpend must be a positive integer');
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
        reason: `SPEND: -${pointsToSpend} for orderNumber=${order?.orderNumber ?? 'unknown'}`
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
        total: true,
        currency: true,
        userId: true
      }
    });

    if (!order) throw new Error('Order not found');
    if (!order.userId) {
      // Guest checkout: no user to award to.
      return null;
    }

    const earnedPoints = roundToNearestInt(order.total * 0.05);

    const pointsRow = await tx.points.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        kind: PointsKind.EARN,
        delta: earnedPoints,
        reason: `EARN: +${earnedPoints} (5% of ${order.total} ${order.currency}) for orderNumber=${order.orderNumber}`
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


