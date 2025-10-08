import { prisma } from './prisma';
import { parseSku } from './sku-parser';

export interface CreateOrderData {
  orderNumber: string;
  total: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  items: {
    productName: string;
    productSku: string;
    colorName?: string;
    size?: string;
    quantity: number;
    price: number;
  }[];
}

export async function createOrder(data: CreateOrderData) {
  try {
    const order = await prisma.order.create({
      data: {
        orderNumber: data.orderNumber,
        total: data.total,
        currency: data.currency || 'ILS',
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        orderItems: {
          create: data.items.map(item => {
            // Parse the SKU to extract base SKU, color, and size
            const parsedSku = parseSku(item.productSku);
            
            // Use parsed values if not explicitly provided
            const baseSku = parsedSku.baseSku || item.productSku;
            const colorName = item.colorName || parsedSku.colorName;
            const size = item.size || parsedSku.size;

            console.log(`[ORDER] Parsing SKU: ${item.productSku} -> Base: ${baseSku}, Color: ${colorName}, Size: ${size}`);

            return {
              quantity: item.quantity,
              price: item.price,
              total: item.quantity * item.price,
              productName: item.productName,
              productSku: baseSku, // Store only the base SKU
              colorName: colorName,
              size: size,
            };
          }),
        },
      },
      include: {
        orderItems: true,
      },
    });

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
