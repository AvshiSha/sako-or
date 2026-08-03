import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs'
import { CardComAPI, createPaymentSessionRequest } from '../../../../lib/cardcom';
import { CreateLowProfileRequest } from '../../../../app/types/checkout';
import { createOrder, generateOrderNumber } from '../../../../lib/orders';
import { prisma } from '../../../../lib/prisma';
import { spendPointsForOrder } from '../../../../lib/points';
import { getBearerToken, requireUserAuth } from '@/lib/server/auth';
import { FREE_DELIVERY_THRESHOLD_ILS, DELIVERY_FEE_ILS } from '../../../../lib/pricing';
import { validateCartItems } from '../../../../lib/cart-validation';
import { staticPageService } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const body: CreateLowProfileRequest = await request.json().catch(() => ({}));
    console.log('Payment request received:', JSON.stringify(body, null, 2));

    // Optional auth: if a Firebase bearer token is provided, link the order to that user.
    // Only link to existing confirmed users - do NOT create partial users here.
    const bearerToken = getBearerToken(request);

    // Authoritative server-side revalidation against live inventory.
    // The client's `items`/`amount`/`subtotal` are never trusted for pricing or
    // availability - every line is re-fetched and re-priced from the product
    // catalog right before an order/charge is created.
    const requestedItems = (body.items && body.items.length > 0 ? body.items : []).map(item => ({
      sku: item.productSku,
      color: item.color ?? null,
      size: item.size ?? null,
      quantity: item.quantity,
    }));

    // Cart re-validation, user resolution, and the terms-page lookup are all
    // independent of each other - kick them all off now and await together
    // (below) instead of resolving each fully before starting the next.
    const cartValidationPromise = validateCartItems(requestedItems);

    // Server-authoritative acceptance record: the exact "last updated" date of
    // the published /terms content at the moment of purchase (not trusted from
    // the client), so a later edit to the terms doesn't retroactively change
    // what an already-placed order is on record as having agreed to.
    const termsPagePromise = staticPageService.getPublishedStaticPage('terms').catch(() => null);

    const userResolutionPromise: Promise<{ userId?: string; authError?: NextResponse }> = bearerToken
      ? (async (): Promise<{ userId?: string; authError?: NextResponse }> => {
          try {
            const auth = await requireUserAuth(request);
            if (auth instanceof NextResponse) return { authError: auth };
            const firebaseUid = auth.firebaseUid;

            // Read-only lookup: only link order to existing confirmed user
            const user = await prisma.user.findUnique({
              where: { firebaseUid },
              select: { id: true, firstName: true, lastName: true, phone: true, language: true }
            });

            // Only set userId if user exists and has completed profile (required fields present)
            if (user && user.firstName && user.lastName && user.phone && user.language) {
              console.log('[CREATE_LOW_PROFILE] Linked order to confirmed user:', user.id);
              return { userId: user.id };
            }

            const missingFields: string[] = [];
            if (!user) {
              missingFields.push('user not found in Neon');
            } else {
              if (!user.firstName) missingFields.push('firstName');
              if (!user.lastName) missingFields.push('lastName');
              if (!user.phone) missingFields.push('phone');
              if (!user.language) missingFields.push('language');
            }
            console.log('[CREATE_LOW_PROFILE] User not confirmed or incomplete, treating as guest. Missing fields:', missingFields);
            return {};
          } catch {
            // Treat invalid/expired token as guest checkout
            console.warn('[CREATE_LOW_PROFILE] Invalid bearer token, proceeding as guest');
            return {};
          }
        })()
      : Promise.resolve({});

    // Debug environment variables
    console.log('Environment variables:', {
      CARDCOM_TERMINAL_NUMBER: process.env.CARDCOM_TERMINAL_NUMBER ? 'Set' : 'Not set',
      CARDCOM_API_NAME: process.env.CARDCOM_API_NAME ? 'Set' : 'Not set',
      NODE_ENV: process.env.NODE_ENV,
    });

    // Validate required fields
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields: amount' },
        { status: 400 }
      );
    }

    if (!body.customer.firstName || !body.customer.lastName || !body.customer.email || !body.customer.mobile) {
      return NextResponse.json(
        { error: 'Missing required customer information' },
        { status: 400 }
      );
    }

    // Server-side re-validation, never trust the disabled/checked state of the
    // client's checkbox alone — a request replayed or crafted without going
    // through the checkout UI must still be rejected.
    if (body.termsAccepted !== true) {
      return NextResponse.json(
        { error: 'You must accept the Terms & Conditions to continue.', code: 'TERMS_NOT_ACCEPTED' },
        { status: 400 }
      );
    }

    // Validate email format (reject double dots e.g. user@gmail..com)
    const customerEmail = body.customer.email;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (customerEmail.includes('..') || !emailRegex.test(customerEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (requestedItems.length === 0) {
      return NextResponse.json(
        { error: 'Your cart is empty or no longer valid. Please refresh your cart and try again.', code: 'CART_EMPTY' },
        { status: 409 }
      );
    }

    const [{ userId, authError }, validation, termsPage] = await Promise.all([
      userResolutionPromise,
      cartValidationPromise,
      termsPagePromise,
    ]);
    if (authError) return authError;
    const unavailableItem = validation.items.find(i => !i.available);
    if (unavailableItem) {
      const code = unavailableItem.reasonCode === 'STOCK_INSUFFICIENT' || unavailableItem.adjusted
        ? 'STOCK_INSUFFICIENT'
        : 'ITEM_UNAVAILABLE';
      return NextResponse.json(
        { error: `The item ${unavailableItem.sku} is no longer available. Please refresh your cart.`, code, sku: unavailableItem.sku },
        { status: 409 }
      );
    }

    if (validation.purchasableSubtotal <= 0) {
      return NextResponse.json(
        { error: 'Your cart has no purchasable items. Please refresh your cart.', code: 'CART_INVALID' },
        { status: 409 }
      );
    }

    // Same precision as money (2 decimals) so invoice totals match
    const pointsToSpend = body.pointsToSpend != null && body.pointsToSpend > 0
      ? Math.round(body.pointsToSpend * 100) / 100
      : 0;
    if (pointsToSpend > 0 && !userId) {
      return NextResponse.json(
        { error: 'Must be logged in to spend points' },
        { status: 401 }
      );
    }

    // Validate points balance if points are being used (but don't deduct yet - that happens after payment success)
    if (pointsToSpend > 0 && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { pointsBalance: true }
      });

      // Prisma stores decimals as Decimal objects; convert to number before comparison
      if (!user || user.pointsBalance === null) {
        return NextResponse.json(
          { error: 'Insufficient points balance' },
          { status: 400 }
        );
      }

      const pointsBalanceNumber = user.pointsBalance.toNumber();
      if (pointsBalanceNumber < pointsToSpend) {
        return NextResponse.json(
          { error: 'Insufficient points balance' },
          { status: 400 }
        );
      }
    }

    // Enforce 15% cap: points cannot exceed 15% of order (subtotal minus coupon discounts)
    if (pointsToSpend > 0) {
      const cartAmountBeforePoints = Math.max((body.subtotal ?? 0) - (body.discountTotal ?? 0), 0);
      const maxPointsAllowed = Math.round(0.15 * cartAmountBeforePoints * 100) / 100;
      if (pointsToSpend > maxPointsAllowed) {
        return NextResponse.json(
          { error: 'Points cannot exceed 15% of the order' },
          { status: 400 }
        );
      }
    }

    const shippingMethod = body.shippingMethod ?? 'delivery';

    if (shippingMethod !== 'pickup') {
      if (!body.deliveryAddress.city || !body.deliveryAddress.streetName || !body.deliveryAddress.streetNumber) {
        return NextResponse.json(
          { error: 'Missing required delivery address information' },
          { status: 400 }
        );
      }
    }

    // Generate order number - always use server-side generation for uniqueness
    let orderNumber = generateOrderNumber();
    
    // Check if the provided order ID exists and handle accordingly
    if (body.orderId) {
      const existingOrder = await prisma.order.findUnique({
        where: { orderNumber: body.orderId }
      });
      
      if (existingOrder) {
        // If order exists and is in a failed/cancelled state, we can reuse it
        if (existingOrder.status === 'failed' || existingOrder.status === 'cancelled') {
          console.log(`Reusing existing failed/cancelled order: ${body.orderId}`);
          orderNumber = body.orderId;
          
          // Delete the old order to recreate it
          await prisma.order.delete({
            where: { orderNumber: body.orderId }
          });
        } else {
          // Order exists and is pending/processing/completed - generate new order number
          console.log(`Order ${body.orderId} already exists with status ${existingOrder.status}, generating new order number`);
          orderNumber = generateOrderNumber();
        }
      } else {
        // Order doesn't exist, we can use the provided ID
        orderNumber = body.orderId;
      }
    }

    // Build order items solely from the server-validated data above - never
    // from client-supplied names/prices - so a stale/tampered client payload
    // can't change what gets charged or recorded.
    const isHebrewLanguage = body.language === 'he';
    const orderItems = validation.items.map(item => {
      const colorName = item.color ? item.color.charAt(0).toUpperCase() + item.color.slice(1) : null;
      const modelNumber = colorName ? `${item.sku}-${colorName.toUpperCase()}` : item.sku;
      const productName = (isHebrewLanguage ? item.name.he : item.name.en) || item.name.en || item.name.he || item.sku;
      // The unit price actually charged: the valid sale price when present, otherwise the regular price.
      const chargedUnitPrice = item.salePrice ?? item.price;

      return {
        productName,
        productSku: item.sku,
        quantity: item.finalQuantity,
        price: chargedUnitPrice,
        colorName: item.color ?? undefined,
        size: item.size ?? undefined,
        primaryImage: item.image ?? undefined,
        salePrice: item.salePrice ?? undefined,
        modelNumber,
      };
    });

    const requestedCouponCodes = body.coupons?.map(coupon => coupon.code.toUpperCase()) ?? [];
    const couponRecords = requestedCouponCodes.length > 0
      ? await prisma.coupon.findMany({
          where: {
            code: {
              in: requestedCouponCodes
            }
          }
        })
      : [];
    const couponMap = new Map<string, string>();
    couponRecords.forEach(record => {
      couponMap.set(record.code.toUpperCase(), record.id);
    });

    // Never trust body.subtotal - always use the server-recomputed, validated total.
    const computedSubtotal = validation.purchasableSubtotal;
    const rawDiscountTotal = body.discountTotal ?? 0;
    const pointsDiscount = pointsToSpend;
    const discountedSubtotal = Math.max(computedSubtotal - rawDiscountTotal - pointsDiscount, 0);
    const hasPromotions = rawDiscountTotal > 0 || pointsDiscount > 0;

    // For pickup orders, delivery fee must always be 0.
    // A cart with no merchandise must never be charged shipping alone
    // (should be unreachable given the CART_INVALID gate above, kept as a hard guard).
    let computedDeliveryFee: number;
    if (shippingMethod === 'pickup' || computedSubtotal <= 0) {
      computedDeliveryFee = 0;
    } else if (computedSubtotal >= FREE_DELIVERY_THRESHOLD_ILS) {
      if (discountedSubtotal >= FREE_DELIVERY_THRESHOLD_ILS) {
        // Still above threshold after discounts – keep free delivery
        computedDeliveryFee = 0;
      } else if (hasPromotions) {
        // Qualified before discounts, dropped below with promos – charge delivery
        computedDeliveryFee = DELIVERY_FEE_ILS;
      } else {
        // No promotions, above threshold – free delivery
        computedDeliveryFee = 0;
      }
    } else {
      // Below threshold before discounts – use base rule (delivery fee applies)
      computedDeliveryFee = DELIVERY_FEE_ILS;
    }

    // Honor discountTotal from the client (coupons or automatic BOGO),
    // but keep a safety fallback if it's missing.
    const computedDiscountTotal = body.discountTotal ?? Math.max(computedSubtotal + computedDeliveryFee - body.amount, 0);

    // Enforce no double-discount stacking between automatic BOGO and coupons.
    const hasBogoDiscount = !!body.bogoDiscountAmount && body.bogoDiscountAmount > 0;
    const hasCoupons = Array.isArray(body.coupons) && body.coupons.length > 0;
    if (hasBogoDiscount && hasCoupons) {
      return NextResponse.json(
        { error: 'Coupons cannot be combined with the automatic pairs deal.' },
        { status: 400 }
      );
    }

    // Prepare Cardcom products from the same server-validated order items that will be persisted.
    // Built and verified BEFORE the order is written, so a mismatch rejects cleanly with no DB row created.
    const cardcomProducts = orderItems.map(item => ({
      ProductID: item.productSku,
      Description: item.productName,
      Quantity: item.quantity,
      UnitCost: item.price, // Price per unit
      TotalLineCost: item.price * item.quantity, // Total for this line
      IsVatFree: false
    }));

    // Apply order-level discounts proportionally to CardCom products so document totals match charge amount
    if (computedDiscountTotal > 0 && cardcomProducts.length > 0) {
      const subtotalBeforeDiscount = cardcomProducts.reduce((sum, product) => {
        return sum + (product.UnitCost * product.Quantity);
      }, 0);

      if (subtotalBeforeDiscount > 0) {
        let remainingDiscount = parseFloat(computedDiscountTotal.toFixed(2));

        cardcomProducts.forEach((product, index) => {
          const quantity = product.Quantity && product.Quantity > 0 ? product.Quantity : 1;
          const originalLineTotal = product.UnitCost * quantity;

          let lineDiscount: number;
          if (index === cardcomProducts.length - 1) {
            lineDiscount = remainingDiscount;
          } else {
            lineDiscount = parseFloat(((originalLineTotal / subtotalBeforeDiscount) * computedDiscountTotal).toFixed(2));
            // Guard against rounding pushing discount beyond remaining amount
            if (lineDiscount > remainingDiscount) {
              lineDiscount = remainingDiscount;
            }
            remainingDiscount = parseFloat((remainingDiscount - lineDiscount).toFixed(2));
          }

          const discountedLineTotal = parseFloat((originalLineTotal - lineDiscount).toFixed(2));
          const discountedUnitCost = parseFloat((discountedLineTotal / quantity).toFixed(2));

          product.UnitCost = discountedUnitCost;
          product.TotalLineCost = parseFloat((discountedUnitCost * quantity).toFixed(2));
        });
      }
    }

    // Delivery fee is charged in full and isn't part of the coupon/promo discount
    // proportioning above (shipping isn't discountable merchandise) - add it as its
    // own line AFTER that loop so calculatedTotal below actually includes it. Without
    // this line, any order with a non-zero delivery fee would never match `body.amount`
    // (which does include delivery fee) and would be rejected as AMOUNT_MISMATCH.
    if (computedDeliveryFee > 0) {
      cardcomProducts.push({
        ProductID: 'DELIVERY',
        Description: isHebrewLanguage ? 'משלוח' : 'Delivery',
        Quantity: 1,
        UnitCost: computedDeliveryFee,
        TotalLineCost: computedDeliveryFee,
        IsVatFree: false
      });
    }

    // Verify the total matches. A mismatch beyond float rounding tolerance means the client's
    // `amount` doesn't reflect the server-validated cart - reject rather than silently
    // rewriting a CardCom line to "make the numbers fit" (that silent rewrite is exactly the
    // class of bug that let a shipping-only charge through in the past).
    const calculatedTotal = cardcomProducts.reduce((sum, product) => sum + product.TotalLineCost, 0);
    if (Math.abs(calculatedTotal - body.amount) > 0.01) {
      console.warn(`Total mismatch: calculated ${calculatedTotal} vs amount ${body.amount}`);
      return NextResponse.json(
        { error: 'Cart total does not match. Please refresh your cart and try again.', code: 'AMOUNT_MISMATCH' },
        { status: 409 }
      );
    }

    const termsAcceptedVersion = termsPage?.updatedAt;
    const termsAcceptedAt = new Date();

    // Create order in database
    let order;
    try {
      order = await createOrder({
        orderNumber,
        total: body.amount,
        subtotal: computedSubtotal,
        discountTotal: computedDiscountTotal,
        bogoDiscountAmount: hasBogoDiscount ? body.bogoDiscountAmount : undefined,
        deliveryFee: computedDeliveryFee,
        shippingMethod,
        pickupLocation: body.pickupLocation,
        currency: body.currencyIso === 2 ? 'USD' : 'ILS',
        customerName: `${body.customer.firstName} ${body.customer.lastName}`,
        customerEmail: body.customer.email,
        customerPhone: body.customer.mobile,
        userId,
        termsAcceptedVersion,
        termsAcceptedAt,
        items: orderItems,
        coupons: hasBogoDiscount
          ? undefined
          : body.coupons?.map(coupon => ({
              code: coupon.code,
              discountAmount: coupon.discountAmount,
              discountType: coupon.discountType,
              stackable: coupon.stackable,
              description: coupon.description,
              couponId: couponMap.get(coupon.code.toUpperCase())
            }))
      });
    } catch (createError: any) {
      Sentry.captureException(createError);
      // If we still get a unique constraint error, retry with a new order number
      if (createError.code === 'P2002') {
        console.log('Duplicate order number detected, generating new one');
        orderNumber = generateOrderNumber();
        order = await createOrder({
          orderNumber,
          total: body.amount,
          subtotal: computedSubtotal,
          discountTotal: computedDiscountTotal,
          bogoDiscountAmount: hasBogoDiscount ? body.bogoDiscountAmount : undefined,
          deliveryFee: computedDeliveryFee,
          shippingMethod,
          pickupLocation: body.pickupLocation,
          currency: body.currencyIso === 2 ? 'USD' : 'ILS',
          customerName: `${body.customer.firstName} ${body.customer.lastName}`,
          customerEmail: body.customer.email,
          customerPhone: body.customer.mobile,
          userId,
          termsAcceptedVersion,
          termsAcceptedAt,
          items: orderItems,
          coupons: hasBogoDiscount
            ? undefined
            : body.coupons?.map(coupon => ({
                code: coupon.code,
                discountAmount: coupon.discountAmount,
                discountType: coupon.discountType,
                stackable: coupon.stackable,
                description: coupon.description
              }))
        });
      } else {
        throw createError;
      }
    }

    // Store pointsToSpend in paymentData metadata for later deduction after payment success
    // Points are NOT deducted here - they are only deducted after successful payment in check-status route
    const paymentMetadata = pointsToSpend > 0 ? { pointsToSpend } : {};

    // Create CardCom payment session request
    const STORE_ADDRESS = 'Rothschild 51, Rishon Lezion';
    const STORE_CITY = 'Rishon Lezion';

    const cardcomRequest = createPaymentSessionRequest(
      orderNumber,
      body.amount,
      body.currencyIso === 2 ? 'USD' : 'ILS',
      {
        customerEmail: body.customer.email,
        customerName: `${body.customer.firstName} ${body.customer.lastName}`,
        customerPhone: body.customer.mobile,
        productName: orderItems.map(item => `${item.productName} x${item.quantity}`).join(', '),
        createToken: false,
        createDocument: true,
        language: body.language || 'he',
        // Receipt/Document options
        customerTaxId: "",
        customerAddress: shippingMethod === 'pickup'
          ? STORE_ADDRESS
          : `${body.deliveryAddress.streetName} ${body.deliveryAddress.streetNumber}`,
        customerAddress2: "",
        customerCity: shippingMethod === 'pickup'
          ? STORE_CITY
          : body.deliveryAddress.city,
        customerMobile: body.customer.mobile,
        documentComments: `Order: ${orderNumber}`,
        departmentId: "",
        Products: cardcomProducts
      }
    );

    // Call CardCom API
    console.log('CardCom request being sent:', JSON.stringify(cardcomRequest, null, 2));
    const cardcomAPI = new CardComAPI();
    const cardcomResponse = await cardcomAPI.createLowProfile(cardcomRequest);

    // Update order with CardCom Low Profile ID and store pointsToSpend in paymentData metadata
    await prisma.order.update({
      where: { id: order.id },
      data: {
        cardcomLowProfileId: cardcomResponse.LowProfileId,
        status: 'processing',
        paymentStatus: 'processing',
        paymentData: pointsToSpend > 0 ? JSON.stringify({ pointsToSpend }) : null,
      },
    });

    // Return the payment URL to the client
    return NextResponse.json({
      success: true,
      paymentUrl: cardcomResponse.Url,
      lowProfileId: cardcomResponse.LowProfileId,
      orderId: orderNumber,
      orderDbId: order.id,
      amount: body.amount,
      currency: body.currencyIso === 2 ? 'USD' : 'ILS',
    });

  } catch (error) {
    Sentry.captureException(error);
    console.error('Payment creation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create payment session',
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
