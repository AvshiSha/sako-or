import { prisma } from './prisma';
import { parseSku } from './sku-parser';
import { CouponDiscountType } from '@prisma/client';
import { markCartItemsAsCheckedOut } from './cart-status';

export interface CreateOrderData {
  orderNumber: string;
  total: number;
  subtotal?: number;
  discountTotal?: number;
  /**
   * Optional: automatic BOGO discount amount applied to this order.
   * When present and > 0, coupons should not be combined with this order.
   */
  bogoDiscountAmount?: number;
  deliveryFee?: number;
  /**
   * Shipping method for the order.
   * - "delivery" (default): standard home delivery with deliveryFee rules
   * - "pickup": self pickup from store, deliveryFee should be 0
   */
  shippingMethod?: 'delivery' | 'pickup';
  /**
   * Pickup location for self-pickup orders (e.g. store address)
   */
  pickupLocation?: string;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  userId?: string;
  items: {
    productName: string;
    productSku: string;
    colorName?: string;
    size?: string;
    quantity: number;
    price: number;
    primaryImage?: string;
    salePrice?: number;
    modelNumber?: string;
  }[];
  coupons?: Array<{
    code: string;
    discountAmount: number;
    discountType: CouponDiscountType;
    stackable: boolean;
    description?: string;
    couponId?: string;
  }>;
}

export async function createOrder(data: CreateOrderData) {
  try {
    const order = await prisma.order.create({
      data: {
        orderNumber: data.orderNumber,
        total: data.total,
        subtotal: data.subtotal ?? data.total,
        discountTotal: data.discountTotal ?? 0,
        bogoDiscountAmount: data.bogoDiscountAmount ?? null,
        deliveryFee: data.deliveryFee ?? 0,
        shippingMethod: data.shippingMethod ?? 'delivery',
        pickupLocation: data.pickupLocation ?? null,
        currency: data.currency || 'ILS',
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        ...(data.userId ? { userId: data.userId } : {}),
        orderItems: {
          create: data.items.map(item => {
            // Parse the SKU to extract base SKU, color, and size
            const parsedSku = parseSku(item.productSku);
            
            // Use parsed values if not explicitly provided
            const baseSku = parsedSku.baseSku || item.productSku;
            const colorName = item.colorName || parsedSku.colorName;
            const size = item.size || parsedSku.size;

            console.log(`[ORDER] Parsing SKU: ${item.productSku} -> Base: ${baseSku}, Color: ${colorName}, Size: ${size}`);

            // Generate model number: baseSku + colorName (e.g., "SKU-123-BLACK")
            const modelNumber = colorName 
              ? `${baseSku}-${colorName.toUpperCase()}` 
              : baseSku;

            return {
              quantity: item.quantity,
              price: item.price,
              total: item.quantity * item.price,
              productName: item.productName,
              productSku: baseSku, // Store only the base SKU
              colorName: colorName,
              size: size,
              primaryImage: item.primaryImage || null,
              salePrice: item.salePrice || null,
              modelNumber: item.modelNumber || modelNumber,
            };
          }),
        },
        appliedCoupons: data.coupons && data.coupons.length > 0
          ? {
              create: data.coupons.map(coupon => ({
                code: coupon.code,
                discountAmount: coupon.discountAmount,
                discountType: coupon.discountType,
                stackable: coupon.stackable,
                description: coupon.description ?? null,
                couponId: coupon.couponId ?? undefined
              }))
            }
          : undefined,
      },
      include: {
        orderItems: true,
        appliedCoupons: true,
      },
    });

    // Mark cart items as CHECKED_OUT for signed-in users
    if (data.userId) {
      await markCartItemsAsCheckedOut(order.orderNumber, data.userId);
    }

    return order;
  } catch (error) {
    console.error('Failed to create order:', error);
    throw error;
  }
}

export async function getOrderByNumber(orderNumber: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        orderItems: true,
        payments: true,
      },
    });

    return order;
  } catch (error) {
    console.error('Failed to get order:', error);
    throw error;
  }
}

export async function updateOrderStatus(
  orderNumber: string,
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
  paymentStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
) {
  try {
    const order = await prisma.order.update({
      where: { orderNumber },
      data: {
        status,
        ...(paymentStatus && { paymentStatus: paymentStatus }),
        updatedAt: new Date(),
      },
    });

    return order;
  } catch (error) {
    console.error('Failed to update order status:', error);
    throw error;
  }
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SAKO-${timestamp}-${random}`;
}

/**
 * Parse payment data from JSON string (SQLite compatibility)
 */
export function parsePaymentData(paymentData: string | null): any {
  if (!paymentData) return null;
  try {
    return JSON.parse(paymentData);
  } catch (error) {
    console.error('Failed to parse payment data:', error);
    return null;
  }
}

/**
 * Stringify payment data for storage (SQLite compatibility)
 */
export function stringifyPaymentData(data: any): string | null {
  if (!data) return null;
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.error('Failed to stringify payment data:', error);
    return null;
  }
}

