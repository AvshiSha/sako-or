import { prisma } from './prisma';
import { parsePaymentData } from './orders';
import { sendOrderConfirmationEmailIdempotent } from './email';
import { triggerInforuAutomationIdempotent, e164ToLocalPhone } from './inforu';

/** Normalize email for lookup: trim, remove RTL/LTR marks, collapse ".." so we can match despite typos. */
function normalizeEmailForLookup(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return email
    .trim()
    .replace(/\u200f|\u200e/g, '') // RTL mark, LTR mark
    .replace(/\.\.+/g, '.');
}

/**
 * Handle post-payment actions (emails, SMS notifications, etc.)
 * This function is idempotent and can be called multiple times safely.
 * 
 * @param orderId - The order number (orderNumber field)
 * @param requestUrl - Optional URL for language detection (defaults to empty string)
 */
export async function handlePostPaymentActions(
  orderId: string,
  requestUrl: string = ''
): Promise<void> {
  try {
    // Fetch order with items
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderId },
      include: {
        orderItems: true,
        appliedCoupons: true,
        points: true,
      },
    });

    if (!order || !order.customerEmail) {
      console.log(`[POST_PAYMENT] Skipping post-payment actions for order ${orderId} - no order or email`);
      return;
    }

    // Fetch checkout: exact email first, then by normalized email (handles RTL/double-dot typos)
    let checkout = await prisma.checkout.findFirst({
      where: { customerEmail: order.customerEmail },
      orderBy: { createdAt: 'desc' },
    });
    if (!checkout) {
      const normalizedOrderEmail = normalizeEmailForLookup(order.customerEmail);
      if (normalizedOrderEmail) {
        const windowStart = new Date(order.createdAt);
        windowStart.setMinutes(windowStart.getMinutes() - 15);
        const windowEnd = new Date(order.createdAt);
        windowEnd.setMinutes(windowEnd.getMinutes() + 5);
        const recent = await prisma.checkout.findMany({
          where: { createdAt: { gte: windowStart, lte: windowEnd } },
          orderBy: { createdAt: 'desc' },
        });
        checkout = recent.find(
          (c) => normalizeEmailForLookup(c.customerEmail) === normalizedOrderEmail
        ) ?? null;
      }
    }

    // Build items for template
    const items = order.orderItems.map((item: any) => ({
      name: item.productName,
      quantity: item.quantity,
      price: item.price,
      size: item.size,
      sku: item.productSku,
      colorName: item.colorName || undefined,
    }));

    // Extract language from request URL parameters (if provided)
    let if_he = true; // Default to Hebrew
    if (requestUrl) {
      try {
        const url = new URL(requestUrl);
        const langParam = url.searchParams.get('lang');
        if_he = langParam === 'he' || !langParam;
      } catch {
        // If URL parsing fails, default to Hebrew
      }
    }

    // Extract customer and delivery data: prefer checkout, fallback to order fields
    const payer = checkout
      ? {
          firstName: checkout.customerFirstName,
          lastName: checkout.customerLastName,
          email: checkout.customerEmail,
          mobile: checkout.customerPhone,
          idNumber: checkout.customerID || '',
        }
      : (() => {
          const fullName = (order.customerName || '').trim();
          const spaceIndex = fullName.indexOf(' ');
          const firstName = spaceIndex > 0 ? fullName.slice(0, spaceIndex) : fullName || '';
          const lastName = spaceIndex > 0 ? fullName.slice(spaceIndex + 1) : '';
          return {
            firstName,
            lastName,
            email: order.customerEmail || '',
            mobile: order.customerPhone || '',
            idNumber: '',
          };
        })();

    const STORE_ADDRESS = 'Rothschild 51, Rishon Lezion';
    const STORE_CITY = 'Rishon Lezion';
    const STORE_ADDRESS_HE = 'רוטשילד 51, ראשון לציון';
    const STORE_CITY_HE = 'ראשון לציון';

    // Narrow string from DB to the union type expected by emails
    const rawShippingMethod = order.shippingMethod ?? 'delivery';
    const shippingMethod: 'delivery' | 'pickup' =
      rawShippingMethod === 'pickup' ? 'pickup' : 'delivery';
    const pickupLocation =
      order.pickupLocation ?? (if_he ? STORE_ADDRESS_HE : STORE_ADDRESS);

    const deliveryAddress = checkout
      ? {
          city: checkout.customerCity,
          streetName: checkout.customerStreetName,
          streetNumber: checkout.customerStreetNumber,
          floor: checkout.customerFloor || '',
          apartmentNumber: checkout.customerApartment || '',
          zipCode: checkout.customerZip || '',
        }
      : shippingMethod === 'pickup'
      ? {
          city: if_he ? STORE_CITY_HE : STORE_CITY,
          streetName: if_he ? STORE_ADDRESS_HE : STORE_ADDRESS,
          streetNumber: '',
          floor: '',
          apartmentNumber: '',
          zipCode: '',
        }
      : {
          city: '',
          streetName: '',
          streetNumber: '',
          floor: '',
          apartmentNumber: '',
          zipCode: '',
        };

    // Send confirmation email with Resend (idempotent)
    // Use corrected email as recipient so typo addresses (e.g. user@gmail..com) still receive the email
    const sendToEmail = normalizeEmailForLookup(order.customerEmail) || order.customerEmail;
    const displayName = checkout
      ? `${checkout.customerFirstName} ${checkout.customerLastName}`.trim()
      : (order.customerName || '');

    console.log(`[POST_PAYMENT] Processing order ${orderId} confirmation`);

    // Points spent: prefer Point record (created when points are deducted), fallback to paymentData (set at checkout, preserved through webhook)
    const pointsSpentRecord = order.points?.find((p) => p.kind === 'SPEND');
    const pointsSpentFromRecord =
      pointsSpentRecord && Number(pointsSpentRecord.delta) !== 0
        ? Math.abs(Number(pointsSpentRecord.delta))
        : undefined;
    const paymentData = parsePaymentData(order.paymentData);
    const pointsSpentFromPayment =
      paymentData?.pointsToSpend != null && paymentData?.pointsToSpend > 0
        ? Number(paymentData.pointsToSpend)
        : undefined;
    const pointsSpent = pointsSpentFromRecord ?? pointsSpentFromPayment ?? undefined;

    const emailResult = await sendOrderConfirmationEmailIdempotent(
      {
        customerEmail: sendToEmail,
        customerName: displayName || sendToEmail,
        orderNumber: order.orderNumber,
        orderDate: new Date(order.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        items: items,
        total: order.total,
        subtotal: order.subtotal ?? undefined,
        deliveryFee: order.deliveryFee ?? undefined,
        discountTotal: order.discountTotal ?? undefined,
        coupons: order.appliedCoupons.map((coupon) => ({
          code: coupon.code,
          discountAmount: coupon.discountAmount,
          discountLabel: coupon.description ?? undefined,
        })),
        payer: payer,
        deliveryAddress: deliveryAddress,
        notes: checkout?.customerDeliveryNotes || undefined,
        isHebrew: if_he,
        shippingMethod,
        // For Hebrew pickup emails, show address in Hebrew; order may store English pickupLocation from checkout
        pickupLocation:
          if_he && shippingMethod === 'pickup' ? STORE_ADDRESS_HE : pickupLocation,
        pointsSpent,
      },
      orderId
    );

    if (!emailResult.success) {
      console.error(
        `[POST_PAYMENT] Failed to send email for order ${orderId}:`,
        'error' in emailResult ? emailResult.error : 'Unknown error'
      );
    } else if ('skipped' in emailResult && emailResult.skipped) {
      console.log(`[POST_PAYMENT] Email skipped for order ${orderId} - already sent`);
    } else {
      console.log(`[POST_PAYMENT] Order ${orderId} email confirmation sent successfully`);
    }

    // Send purchase confirmation SMS via Inforu (idempotent)
    try {
      // Get phone number with priority: checkout.customerPhone > order.customerPhone
      const phoneNumber = checkout?.customerPhone || order.customerPhone;

      if (phoneNumber) {
        // Convert E.164 format to local format for Inforu
        const localPhone = e164ToLocalPhone(phoneNumber);

        if (localPhone) {
          // Split customer name into first and last name
          const customerNameParts = (order.customerName || '').trim().split(/\s+/);
          const firstName = checkout?.customerFirstName || customerNameParts[0] || '';
          const lastName =
            checkout?.customerLastName || customerNameParts.slice(1).join(' ') || '';

          console.log(`[POST_PAYMENT] Triggering purchase confirmation SMS for order ${orderId}`);

          const smsResult = await triggerInforuAutomationIdempotent(
            {
              apiEventName: 'CustomerPurchase',
              contacts: [
                {
                  firstName: firstName || undefined,
                  lastName: lastName || undefined,
                  email: order.customerEmail || undefined,
                  phoneNumber: localPhone,
                  contactRefId: order.orderNumber,
                },
              ],
            },
            orderId
          );

          if (!smsResult.success) {
            console.error(
              `[POST_PAYMENT] Failed to send SMS for order ${orderId}:`,
              'error' in smsResult ? smsResult.error : 'Unknown error'
            );
          } else if ('skipped' in smsResult && smsResult.skipped) {
            console.log(`[POST_PAYMENT] SMS skipped for order ${orderId} - already sent`);
          } else {
            console.log(`[POST_PAYMENT] Purchase confirmation SMS sent for order ${orderId}`);
          }
        } else {
          console.log(
            `[POST_PAYMENT] Skipping SMS for order ${orderId} - invalid phone number format: ${phoneNumber}`
          );
        }
      } else {
        console.log(`[POST_PAYMENT] Skipping SMS for order ${orderId} - no phone number available`);
      }
    } catch (smsError) {
      // Non-blocking: log error but don't fail the function
      console.error(`[POST_PAYMENT] Error sending SMS for order ${orderId}:`, smsError);
    }
  } catch (error) {
    console.error(`[POST_PAYMENT] Failed to handle post-payment actions for order ${orderId}:`, error);
  }
}
