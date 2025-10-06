import { NextRequest, NextResponse } from 'next/server';

interface Coupon {
  valid: boolean;
  discount: number;
  message: string;
  minOrderAmount: number;
  maxDiscount: number;
  expiresAt: Date;
  freeShipping?: boolean;
}

// Mock coupon data - in production, this would come from a database
const VALID_COUPONS: Record<string, Coupon> = {
  'SUMMERSALE20': {
    valid: true,
    discount: 20,
    message: '20% off your order!',
    minOrderAmount: 100,
    maxDiscount: 200,
    expiresAt: new Date('2024-12-31')
  },
  'WELCOME10': {
    valid: true,
    discount: 10,
    message: 'Welcome discount - 10% off!',
    minOrderAmount: 50,
    maxDiscount: 100,
    expiresAt: new Date('2025-12-31')
  },
  'FREESHIP': {
    valid: true,
    discount: 0,
    message: 'Free shipping on your order!',
    minOrderAmount: 0,
    maxDiscount: 45, // Free shipping value
    expiresAt: new Date('2025-12-31'),
    freeShipping: true
  },
  'NEWCUSTOMER': {
    valid: true,
    discount: 15,
    message: 'New customer discount - 15% off!',
    minOrderAmount: 75,
    maxDiscount: 150,
    expiresAt: new Date('2025-12-31')
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const orderAmount = parseFloat(searchParams.get('amount') || '0');

    if (!code) {
      return NextResponse.json(
        { 
          valid: false, 
          message: 'Coupon code is required' 
        },
        { status: 400 }
      );
    }

    const coupon = VALID_COUPONS[code.toUpperCase() as keyof typeof VALID_COUPONS];

    if (!coupon) {
      return NextResponse.json({
        valid: false,
        message: 'Invalid coupon code'
      });
    }

    // Check if coupon has expired
    if (coupon.expiresAt && new Date() > coupon.expiresAt) {
      return NextResponse.json({
        valid: false,
        message: 'This coupon has expired'
      });
    }

    // Check minimum order amount
    if (orderAmount > 0 && coupon.minOrderAmount > orderAmount) {
      return NextResponse.json({
        valid: false,
        message: `Minimum order amount of ₪${coupon.minOrderAmount} required for this coupon`
      });
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (coupon.freeShipping) {
      discountAmount = Math.min(orderAmount * 0.1, coupon.maxDiscount); // 10% of order or max discount
    } else {
      discountAmount = Math.min(orderAmount * (coupon.discount / 100), coupon.maxDiscount);
    }

    return NextResponse.json({
      valid: true,
      discount: coupon.discount,
      discountAmount: discountAmount,
      message: coupon.message,
      freeShipping: coupon.freeShipping || false
    });

  } catch (error) {
    console.error('Coupon validation error:', error);
    
    return NextResponse.json(
      { 
        valid: false,
        message: 'Failed to validate coupon',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
