import { prisma } from './prisma';
import { buildCartKey } from './cart';

/**
 * Mark cart items as CHECKED_OUT when order is created
 * This tracks items that have entered the checkout flow
 * 
 * IMPORTANT: Only updates items with status IN_CART or CHECKED_OUT.
 * PURCHASED items are immutable/historical and are never modified.
 */
export async function markCartItemsAsCheckedOut(orderId: string, userId?: string) {
  if (!userId) {
    // Guest checkout - no cart persistence
    return;
  }

  try {
    // Fetch the order with items
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderId },
      select: {
        orderNumber: true,
        userId: true,
        orderItems: {
          select: {
            productSku: true,
            colorName: true,
            size: true,
            quantity: true
          }
        }
      }
    });

    if (!order || !order.userId) {
      console.log('[markCartItemsAsCheckedOut] Order has no userId, skipping cart update');
      return;
    }

    const now = new Date();

    // For each order item, compute cartKey and update matching cart row
    for (const orderItem of order.orderItems) {
      const baseSku = orderItem.productSku;
      const colorSlug = orderItem.colorName || null;
      const sizeSlug = orderItem.size || null;
      const cartKey = buildCartKey(baseSku, colorSlug, sizeSlug);

      if (!cartKey) continue;

      try {
        // Update matching cart item to CHECKED_OUT (idempotent)
        // Also updates items already CHECKED_OUT to set the correct orderId
        // IMPORTANT: Only updates mutable statuses - PURCHASED items are never touched
        const result = await prisma.cartItem.updateMany({
          where: {
            userId: order.userId,
            cartKey,
            // Update if currently IN_CART or CHECKED_OUT (to update orderId)
            // PURCHASED items are excluded - they are immutable/historical
            status: {
              in: ['IN_CART', 'CHECKED_OUT']
            }
          },
          data: {
            status: 'CHECKED_OUT',
            orderId: order.orderNumber,
            removedAt: null,
            updatedAt: now
          }
        });

        if (result.count > 0) {
          console.log(`[markCartItemsAsCheckedOut] Marked cart item as CHECKED_OUT: ${cartKey} (order: ${orderId})`);
        }
      } catch (itemError) {
        console.warn(`[markCartItemsAsCheckedOut] Failed to update cart item ${cartKey}:`, itemError);
        // Continue with other items
      }
    }
  } catch (error) {
    console.error('[markCartItemsAsCheckedOut] Error marking cart items as checked out:', error);
    // Don't throw - this is best-effort cleanup
  }
}

/**
 * Mark cart items as PURCHASED for order items (Option 2: match only what was bought)
 * This upgrades items from IN_CART or CHECKED_OUT to PURCHASED when payment is confirmed
 * 
 * IMPORTANT: Once an item is marked as PURCHASED, it becomes immutable/historical.
 * PURCHASED items can never be reverted back to IN_CART or any other status.
 * This ensures data integrity for purchase history, analytics, and automations.
 */
export async function markCartItemsAsPurchased(orderId: string) {
  try {
    // Fetch the order with user and items
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderId },
      select: {
        orderNumber: true,
        userId: true,
        orderItems: {
          select: {
            productSku: true,
            colorName: true,
            size: true,
            quantity: true
          }
        }
      }
    });

    if (!order || !order.userId) {
      // Guest checkout or order not found - no cart persistence
      console.log('[markCartItemsAsPurchased] Order has no userId (guest checkout), skipping cart update');
      return;
    }

    const userId = order.userId;
    const now = new Date();

    // For each order item, compute cartKey and update matching cart row
    for (const orderItem of order.orderItems) {
      const baseSku = orderItem.productSku;
      const colorSlug = orderItem.colorName || null;
      const sizeSlug = orderItem.size || null;
      const cartKey = buildCartKey(baseSku, colorSlug, sizeSlug);

      if (!cartKey) continue;

      try {
        // Update matching cart item to PURCHASED (idempotent)
        // Match both IN_CART and CHECKED_OUT status to handle two-stage flow
        // IMPORTANT: Only updates mutable statuses - already PURCHASED items are never touched
        const result = await prisma.cartItem.updateMany({
          where: {
            userId,
            cartKey,
            // Update if currently IN_CART or CHECKED_OUT (idempotent - won't re-mark already PURCHASED)
            // PURCHASED items are excluded - they are immutable/historical records
            status: {
              in: ['IN_CART', 'CHECKED_OUT']
            }
          },
          data: {
            status: 'PURCHASED',
            orderId: order.orderNumber,
            quantity: orderItem.quantity,
            removedAt: null,
            updatedAt: now
          }
        });

        if (result.count > 0) {
          console.log(`[markCartItemsAsPurchased] Marked cart item as PURCHASED: ${cartKey} (order: ${orderId})`);
        }
      } catch (itemError) {
        console.warn(`[markCartItemsAsPurchased] Failed to update cart item ${cartKey}:`, itemError);
        // Continue with other items
      }
    }
  } catch (error) {
    console.error('[markCartItemsAsPurchased] Error marking cart items as purchased:', error);
    // Don't throw - this is best-effort cleanup
  }
}
