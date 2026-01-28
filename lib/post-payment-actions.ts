import { prisma } from './prisma';
import { sendOrderConfirmationEmailIdempotent } from './email';
import { triggerInforuAutomationIdempotent, e164ToLocalPhone } from './inforu';

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
      },
    });

    if (!order || !order.customerEmail) {
      console.log(`[POST_PAYMENT] Skipping post-payment actions for order ${orderId} - no order or email`);
      return;
    }

    // Fetch checkout data separately using customer email
    const checkout = await prisma.checkout.findFirst({
      where: { customerEmail: order.customerEmail },
      orderBy: { createdAt: 'desc' }, // Get the most recent checkout
    });

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

    // Extract customer and delivery data from checkout
    const payer = checkout
      ? {
          firstName: checkout.customerFirstName,
          lastName: checkout.customerLastName,
          email: checkout.customerEmail,
          mobile: checkout.customerPhone,
          idNumber: checkout.customerID || '',
        }
      : {
          firstName: '',
          lastName: '',
          email: order.customerEmail,
          mobile: '',
          idNumber: '',
        };

    const STORE_ADDRESS = 'Rothschild 51, Rishon Lezion';
    const STORE_CITY = 'Rishon Lezion';

    // Narrow string from DB to the union type expected by emails
    const rawShippingMethod = order.shippingMethod ?? 'delivery';
    const shippingMethod: 'delivery' | 'pickup' =
      rawShippingMethod === 'pickup' ? 'pickup' : 'delivery';
    const pickupLocation = order.pickupLocation ?? STORE_ADDRESS;

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
          city: STORE_CITY,
          streetName: STORE_ADDRESS,
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
    console.log(`[POST_PAYMENT] Processing order ${orderId} confirmation`);

    const emailResult = await sendOrderConfirmationEmailIdempotent(
      {
        customerEmail: order.customerEmail,
        customerName: order.customerName || '',
        orderNumber: order.orderNumber,
        orderDate: new Date(order.createdAt).toLocaleDateString(),
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
        pickupLocation,
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
