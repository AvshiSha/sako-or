import { Product } from '@/lib/firebase'
import { CouponCartItemInput } from '@/lib/coupons'

// Sample products for testing
export const mockProducts: Product[] = [
  {
    id: 'product-1',
    sku: '1234-5678',
    baseSku: '1234-5678',
    title_en: 'Test Product 1',
    title_he: 'מוצר בדיקה 1',
    description_en: 'Test product description',
    description_he: 'תיאור מוצר בדיקה',
    category: 'shoes',
    subCategory: 'sneakers',
    subSubCategory: 'running',
    categories_path: ['shoes', 'sneakers', 'running'],
    categories_path_id: ['cat-1', 'cat-2', 'cat-3'],
    brand: 'Test Brand',
    price: 300,
    salePrice: 250,
    currency: 'ILS',
    colorVariants: {
      'black': {
        colorSlug: 'black',
        isActive: true,
        stockBySize: {
          '40': 5,
          '41': 3,
          '42': 2,
        },
        images: ['https://example.com/image1.jpg'],
        primaryImage: 'https://example.com/image1.jpg',
      },
      'white': {
        colorSlug: 'white',
        isActive: true,
        stockBySize: {
          '40': 0, // Out of stock
          '41': 1,
          '42': 4,
        },
        images: ['https://example.com/image2.jpg'],
        primaryImage: 'https://example.com/image2.jpg',
      },
    },
    isEnabled: true,
    isDeleted: false,
    newProduct: false,
    featuredProduct: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [],
  },
  {
    id: 'product-2',
    sku: '2345-6789',
    baseSku: '2345-6789',
    title_en: 'Test Product 2',
    title_he: 'מוצר בדיקה 2',
    description_en: 'Another test product',
    description_he: 'מוצר בדיקה נוסף',
    category: 'clothing',
    subCategory: 'tops',
    categories_path: ['clothing', 'tops'],
    categories_path_id: ['cat-4', 'cat-5'],
    brand: 'Test Brand 2',
    price: 150,
    currency: 'ILS',
    colorVariants: {
      'red': {
        colorSlug: 'red',
        isActive: true,
        stockBySize: {
          'S': 10,
          'M': 8,
          'L': 5,
        },
        images: ['https://example.com/image3.jpg'],
        primaryImage: 'https://example.com/image3.jpg',
      },
    },
    isEnabled: true,
    isDeleted: false,
    newProduct: true,
    featuredProduct: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [],
  },
]

// Sample cart items
export const mockCartItems: CouponCartItemInput[] = [
  {
    sku: '1234-5678',
    quantity: 2,
    price: 300,
    salePrice: 250,
    color: 'black',
    size: '41',
  },
  {
    sku: '2345-6789',
    quantity: 1,
    price: 150,
    color: 'red',
    size: 'M',
  },
]

// Sample coupons
export const mockCoupons = {
  validPercent: {
    id: 'coupon-1',
    code: 'SAVE20',
    name: { en: '20% Off', he: '20% הנחה' },
    description: { en: 'Get 20% off your order', he: 'קבלו 20% הנחה על ההזמנה' },
    discountType: 'percent_all',
    discountValue: 20,
    stackable: false,
    minCartValue: 100,
    autoApply: false,
    isActive: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  },
  validFixed: {
    id: 'coupon-2',
    code: 'FIXED50',
    name: { en: '50 ILS Off', he: '50 ש"ח הנחה' },
    description: { en: 'Get 50 ILS off', he: 'קבלו 50 ש"ח הנחה' },
    discountType: 'fixed',
    discountValue: 50,
    stackable: true,
    minCartValue: 200,
    autoApply: false,
    isActive: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
  validBogo: {
    id: 'coupon-3',
    code: 'BOGO50',
    name: { en: 'Buy 1 Get 1 50%', he: 'קנה 1 קבל 1 ב-50%' },
    description: { en: 'Buy 1 Get 1 at 50% off', he: 'קנה 1 קבל 1 ב-50% הנחה' },
    discountType: 'bogo',
    discountValue: 50,
    bogoBuyQuantity: 1,
    bogoGetQuantity: 1,
    stackable: false,
    minCartValue: null,
    autoApply: false,
    isActive: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
  expired: {
    id: 'coupon-4',
    code: 'EXPIRED',
    name: { en: 'Expired Coupon', he: 'קופון פג תוקף' },
    description: { en: 'This coupon has expired', he: 'קופון זה פג תוקף' },
    discountType: 'percent_all',
    discountValue: 10,
    stackable: false,
    minCartValue: null,
    autoApply: false,
    isActive: true,
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
  },
  inactive: {
    id: 'coupon-5',
    code: 'INACTIVE',
    name: { en: 'Inactive Coupon', he: 'קופון לא פעיל' },
    description: { en: 'This coupon is inactive', he: 'קופון זה לא פעיל' },
    discountType: 'percent_all',
    discountValue: 10,
    stackable: false,
    minCartValue: null,
    autoApply: false,
    isActive: false,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
}

// Sample user data
export const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  phone: '+972501234567',
  firstName: 'Test',
  lastName: 'User',
  pointsBalance: 1000,
}

// Sample order data
export const mockOrder = {
  id: 'order-1',
  orderId: 'ORD-12345',
  userId: 'user-1',
  total: 550,
  subtotal: 500,
  discountTotal: 50,
  deliveryFee: 45,
  currency: 'ILS',
  status: 'pending',
  createdAt: new Date(),
}

// Helper to create cart item response
export function createCartItemResponse(item: CouponCartItemInput) {
  return {
    success: true,
    cartItem: {
      id: `cart-item-${Date.now()}`,
      userId: mockUser.id,
      baseSku: item.sku,
      colorSlug: item.color || null,
      sizeSlug: item.size || null,
      quantity: item.quantity,
      unitPrice: item.salePrice || item.price,
      status: 'IN_CART',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }
}
