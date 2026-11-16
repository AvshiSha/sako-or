import { prisma } from './prisma';
import { parsePaymentData } from './orders';
import { sendOrderConfirmationEmailIdempotent } from './email';
import { triggerInforuAutomationIdempotent, e164ToLocalPhone } from './inforu';
import { buildAbsoluteUrl } from './seo';
import { normalizeColorSlug as normalizeColorSlugShared } from './colors';
import { resolveOrderDeliveryAddress, hasStoredAddress } from './delivery-address';

/** Normalize email for lookup: trim, remove RTL/LTR marks, collapse ".." so we can match despite typos. */
function normalizeEmailForLookup(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return email
    .trim()
    .replace(/\u200f|\u200e/g, '') // RTL mark, LTR mark
    .replace(/\.\.+/g, '.');
}

function normalizeOrderItemColorSlug(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  return normalizeColorSlugShared(trimmed).replace(/-+/g, '-').replace(/^-|-$/g, '');
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

    // The order carries its own address and contact details (orders.shipping_*),
    // written in the same call that created it.
    //
    // This used to look up the most recent `checkouts` row for the customer's email
    // address instead. That was wrong twice over: a customer who checked out again
    // would have their newer address rendered onto an older order, and when no row
    // existed the email silently fell back to a blank address. Both are gone - the
    // address shown for an order is now the address stored against that order, or
    // nothing at all.

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

    // Build items for email templates (include image + variant URL when available)
    const lng = if_he ? 'he' : 'en';
    const items = order.orderItems.map((item: any) => {
      const baseSku =
        typeof item.productSku === 'string' && item.productSku.trim()
          ? item.productSku.trim()
          : '';
      const colorSlug: string | undefined = normalizeOrderItemColorSlug(item.colorName);

      const productPath = baseSku
        ? colorSlug
          ? `/${lng}/product/${encodeURIComponent(baseSku)}/${encodeURIComponent(colorSlug)}`
          : `/${lng}/product/${encodeURIComponent(baseSku)}`
        : null;

      const rawImageUrl: string | undefined = item.primaryImage || undefined;
      const imageUrl = rawImageUrl
        ? rawImageUrl.startsWith('http://') || rawImageUrl.startsWith('https://')
          ? rawImageUrl
          : buildAbsoluteUrl(rawImageUrl)
        : undefined;

      return {
        name: item.productName,
        quantity: item.quantity,
        price: item.price,
        size: item.size,
        sku: baseSku || undefined,
        colorName: colorSlug,
        imageUrl,
        productUrl: productPath ? buildAbsoluteUrl(productPath) : undefined,
      };
    });

    // Customer details, from this order's own columns.
    const payer = (() => {
      const fullName = (order.customerName || '').trim();
      const spaceIndex = fullName.indexOf(' ');
      const firstName = spaceIndex > 0 ? fullName.slice(0, spaceIndex) : fullName || '';
      const lastName = spaceIndex > 0 ? fullName.slice(spaceIndex + 1) : '';
      return {
        firstName,
        lastName,
        email: order.customerEmail || '',
        mobile: order.customerPhone || '',
        idNumber: order.customerIdNumber || '',
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

    // Only reachable for orders placed before orders.shipping_* existed. Nothing is
    // guessed to fill it: a plausible-looking wrong shipping address is worse than a
    // visible blank. Logged without any address values.
    if (!hasStoredAddress(order) && shippingMethod !== 'pickup') {
      console.error(
        `[POST_PAYMENT] Order ${orderId} is a delivery order with no stored address (pre-migration order) - confirmation email will show an EMPTY address.`
      );
    }

    const deliveryAddress = resolveOrderDeliveryAddress(order, shippingMethod, {
      city: if_he ? STORE_CITY_HE : STORE_CITY,
      streetName: if_he ? STORE_ADDRESS_HE : STORE_ADDRESS,
    });

    // Send confirmation email with Resend (idempotent)
    // Use corrected email as recipient so typo addresses (e.g. user@gmail..com) still receive the email
    const sendToEmail = normalizeEmailForLookup(order.customerEmail) || order.customerEmail;
    const displayName = order.customerName || '';

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
        notes: order.shippingNotes || undefined,
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
      const phoneNumber = order.customerPhone;

      if (phoneNumber) {
        // Convert E.164 format to local format for Inforu
        const localPhone = e164ToLocalPhone(phoneNumber);

        if (localPhone) {
          // Split customer name into first and last name
          const customerNameParts = (order.customerName || '').trim().split(/\s+/);
          const firstName = customerNameParts[0] || '';
          const lastName = customerNameParts.slice(1).join(' ') || '';

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
