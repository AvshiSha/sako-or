/**
 * Google Analytics 4 (GA4) Data Layer Utility
 * 
 * This utility provides functions for tracking e-commerce events
 * following the GA4 Enhanced Ecommerce specification.
 */
import { fbqTrackAddToCart, fbqTrackInitiateCheckout, fbqTrackPurchase } from '@/lib/facebookPixel';

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

// Initialize dataLayer if it doesn't exist
if (typeof window !== 'undefined') {
  window.dataLayer = window.dataLayer || [];
}

// GA4 Measurement ID (overridable in env; falls back to provided property)
const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
  'G-1BY36XK59X';

/**
 * Format price to string with dot separator (e.g., "14.00")
 * Removes currency symbols and commas
 */
function formatPrice(price: number | string | undefined): string {
  if (price === undefined || price === null) return '0.00';
  
  const numPrice = typeof price === 'string' ? parseFloat(price.replace(/[^\d.-]/g, '')) : price;
  return numPrice.toFixed(2);
}

function toNumericPrice(price: number | string | undefined): number {
  if (price === undefined || price === null) return 0;
  return typeof price === 'string' ? parseFloat(price.replace(/[^\d.-]/g, '')) : price;
}

/**
 * Get category hierarchy from categories array
 * Supports up to 5 levels (item_category, item_category2, etc.)
 */
function getCategoryHierarchy(categories: string[]): {
  item_category?: string;
  item_category2?: string;
  item_category3?: string;
  item_category4?: string;
  item_category5?: string;
} {
  const result: any = {};
  if (categories && categories.length > 0) {
    result.item_category = categories[0];
    if (categories.length > 1) result.item_category2 = categories[1];
    if (categories.length > 2) result.item_category3 = categories[2];
    if (categories.length > 3) result.item_category4 = categories[3];
    if (categories.length > 4) result.item_category5 = categories[4];
  }
  return result;
}

/**
 * Build item object for data layer events
 */
interface ItemData {
  item_name: string;
  item_id: string;
  price: string;
  item_brand?: string;
  item_category?: string;
  item_category2?: string;
  item_category3?: string;
  item_category4?: string;
  item_category5?: string;
  item_variant?: string;
  item_list_name?: string;
  item_list_id?: string;
  index?: number;
  quantity: string;
  item_coupon?: string;
}

function buildItem(
  productName: string,
  productId: string,
  price: number | string,
  options: {
    brand?: string;
    categories?: string[];
    variant?: string;
    listName?: string;
    listId?: string;
    index?: number;
    quantity?: number;
    coupon?: string;
  } = {}
): ItemData {
  const categoryHierarchy = getCategoryHierarchy(options.categories || []);
  
  return {
    item_name: productName,
    item_id: productId,
    price: formatPrice(price),
    ...(options.brand && { item_brand: options.brand }),
    ...categoryHierarchy,
    ...(options.variant && { item_variant: options.variant }),
    ...(options.listName && { item_list_name: options.listName }),
    ...(options.listId && { item_list_id: options.listId }),
    ...(options.index !== undefined && { index: options.index }),
    quantity: String(options.quantity || 1),
    ...(options.coupon && { item_coupon: options.coupon })
  };
}

/**
 * Clear previous ecommerce data
 */
function clearEcommerce(): void {
  if (typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push({ ecommerce: null });
  }
}

/**
 * Push event to dataLayer
 */
function pushEvent(eventData: any): void {
  if (typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push(eventData);
    // Debug logging in development only
    // Conversion tracking expert can also inspect window.dataLayer directly in browser console
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 DataLayer Event:', JSON.stringify(eventData, null, 2));
    }

    // If gtag is available, mirror purchase events to gtag for GA/Ads
    try {
      if (
        typeof window.gtag === 'function' &&
        eventData &&
        eventData.event === 'purchase' &&
        eventData.ecommerce
      ) {
        const ec = eventData.ecommerce || {};
        const transactionId = ec.transaction_id;
        const value = ec.value;
        const currency = ec.currency || 'ILS';

        // Send simplified purchase event to gtag
        window.gtag('event', 'purchase', {
          transaction_id: transactionId,
          value,
          currency,
          ...(GA_MEASUREMENT_ID && { send_to: GA_MEASUREMENT_ID }),
        });
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('gtag purchase mirror failed:', err);
      }
    }
  }
}

// ============================================================================
// TRACKING FUNCTIONS
// ============================================================================

/**
 * 1. Track product list impressions (view_item_list)
 */
export function trackViewItemList(
  items: Array<{
    name: string;
    id: string;
    price: number | string;
    brand?: string;
    categories?: string[];
    variant?: string;
  }>,
  listName: string,
  listId: string,
  currency: string = 'ILS'
): void {
  clearEcommerce();
  
  const ecommerceItems = items.map((item, index) => 
    buildItem(item.name, item.id, item.price, {
      brand: item.brand,
      categories: item.categories,
      variant: item.variant,
      listName,
      listId,
      index: index + 1,
      quantity: 1
    })
  );

  pushEvent({
    event: 'view_item_list',
    ecommerce: {
      currency,
      items: ecommerceItems
    }
  });
}

/**
 * 2. Track when a product is clicked from a list (select_item)
 */
export function trackSelectItem(
  itemName: string,
  itemId: string,
  price: number | string,
  options: {
    brand?: string;
    categories?: string[];
    variant?: string;
    listName?: string;
    listId?: string;
    index?: number;
    currency?: string;
  } = {}
): void {
  clearEcommerce();
  
  const item = buildItem(itemName, itemId, price, {
    brand: options.brand,
    categories: options.categories,
    variant: options.variant,
    listName: options.listName,
    listId: options.listId,
    index: options.index,
    quantity: 1
  });

  const numPrice = typeof price === 'string' ? parseFloat(price.replace(/[^\d.-]/g, '')) : price;

  pushEvent({
    event: 'select_item',
    ecommerce: {
      currency: options.currency || 'ILS',
      value: numPrice,
      items: [item]
    }
  });
}

/**
 * 3. Track product page view (view_item) - MUST IMPLEMENT
 */
export function trackViewItem(
  itemName: string,
  itemId: string,
  price: number | string,
  options: {
    brand?: string;
    categories?: string[];
    variant?: string;
    quantity?: number;
    currency?: string;
  } = {}
): void {
  clearEcommerce();
  
  const item = buildItem(itemName, itemId, price, {
    brand: options.brand,
    categories: options.categories,
    variant: options.variant,
    quantity: options.quantity || 1
  });

  const numPrice = typeof price === 'string' ? parseFloat(price.replace(/[^\d.-]/g, '')) : price;

  pushEvent({
    event: 'view_item',
    ecommerce: {
      currency: options.currency || 'ILS',
      value: numPrice,
      items: [item]
    }
  });
}

/**
 * 4. Track when product is added to cart (add_to_cart) - MUST IMPLEMENT
 */
export function trackAddToCart(
  items: Array<{
    name: string;
    id: string;
    price: number | string;
    brand?: string;
    categories?: string[];
    variant?: string;
    quantity?: number;
    listName?: string;
    listId?: string;
    index?: number;
  }>,
  currency: string = 'ILS'
): void {
  clearEcommerce();
  
  const ecommerceItems = items.map((item, index) => 
    buildItem(item.name, item.id, item.price, {
      brand: item.brand,
      categories: item.categories,
      variant: item.variant,
      listName: item.listName,
      listId: item.listId,
      index: item.index !== undefined ? item.index : index + 1,
      quantity: item.quantity || 1
    })
  );

  const totalValue = ecommerceItems.reduce((sum, item) => {
    return sum + (parseFloat(item.price) * parseFloat(item.quantity));
  }, 0);

  pushEvent({
    event: 'add_to_cart',
    ecommerce: {
      currency,
      value: totalValue,
      items: ecommerceItems
    }
  });

  fbqTrackAddToCart(
    items.map((item) => ({
      id: item.id,
      quantity: item.quantity || 1,
      item_price: toNumericPrice(item.price),
      brand: item.brand,
      item_variant: item.variant,
    })),
    { currency, value: totalValue }
  );
}

/**
 * 5. Track cart page view (view_cart)
 */
export function trackViewCart(
  items: Array<{
    name: string;
    id: string;
    price: number | string;
    brand?: string;
    categories?: string[];
    variant?: string;
    quantity?: number;
  }>,
  currency: string = 'ILS'
): void {
  clearEcommerce();
  
  const ecommerceItems = items.map((item) => 
    buildItem(item.name, item.id, item.price, {
      brand: item.brand,
      categories: item.categories,
      variant: item.variant,
      quantity: item.quantity || 1
    })
  );

  const totalValue = ecommerceItems.reduce((sum, item) => {
    return sum + (parseFloat(item.price) * parseFloat(item.quantity));
  }, 0);

  pushEvent({
    event: 'view_cart',
    ecommerce: {
      currency,
      value: totalValue,
      items: ecommerceItems
    }
  });
}

/**
 * 6. Track checkout started (begin_checkout) - MUST IMPLEMENT
 */
export function trackBeginCheckout(
  items: Array<{
    name: string;
    id: string;
    price: number | string;
    brand?: string;
    categories?: string[];
    variant?: string;
    quantity?: number;
  }>,
  currency: string = 'ILS'
): void {
  clearEcommerce();
  
  const ecommerceItems = items.map((item) => 
    buildItem(item.name, item.id, item.price, {
      brand: item.brand,
      categories: item.categories,
      variant: item.variant,
      quantity: item.quantity || 1
    })
  );

  const totalValue = ecommerceItems.reduce((sum, item) => {
    return sum + (parseFloat(item.price) * parseFloat(item.quantity));
  }, 0);

  pushEvent({
    event: 'begin_checkout',
    ecommerce: {
      currency,
      value: totalValue,
      items: ecommerceItems
    }
  });

  fbqTrackInitiateCheckout(
    items.map((item) => ({
      id: item.id,
      quantity: item.quantity || 1,
      item_price: toNumericPrice(item.price),
      brand: item.brand,
      item_variant: item.variant,
    })),
    {
      currency,
      value: totalValue,
      num_items: items.reduce((sum, item) => sum + (item.quantity || 1), 0),
    }
  );
}

/**
 * 7. Track shipping info entered (add_shipping_info)
 */
export function trackAddShippingInfo(
  items: Array<{
    name: string;
    id: string;
    price: number | string;
    brand?: string;
    categories?: string[];
    variant?: string;
    quantity?: number;
  }>,
  shippingTier: string,
  currency: string = 'ILS'
): void {
  clearEcommerce();
  
  const ecommerceItems = items.map((item) => 
    buildItem(item.name, item.id, item.price, {
      brand: item.brand,
      categories: item.categories,
      variant: item.variant,
      quantity: item.quantity || 1
    })
  );

  const totalValue = ecommerceItems.reduce((sum, item) => {
    return sum + (parseFloat(item.price) * parseFloat(item.quantity));
  }, 0);

  pushEvent({
    event: 'add_shipping_info',
    ecommerce: {
      currency,
      value: totalValue,
      shipping_tier: shippingTier,
      items: ecommerceItems
    }
  });
}

/**
 * 8. Track payment info entered (add_payment_info)
 */
export function trackAddPaymentInfo(
  items: Array<{
    name: string;
    id: string;
    price: number | string;
    brand?: string;
    categories?: string[];
    variant?: string;
    quantity?: number;
  }>,
  paymentType: string,
  currency: string = 'ILS'
): void {
  clearEcommerce();
  
  const ecommerceItems = items.map((item) => 
    buildItem(item.name, item.id, item.price, {
      brand: item.brand,
      categories: item.categories,
      variant: item.variant,
      quantity: item.quantity || 1
    })
  );

  const totalValue = ecommerceItems.reduce((sum, item) => {
    return sum + (parseFloat(item.price) * parseFloat(item.quantity));
  }, 0);

  pushEvent({
    event: 'add_payment_info',
    ecommerce: {
      currency,
      value: totalValue,
      payment_type: paymentType,
      items: ecommerceItems
    }
  });
}

/**
 * 9. Track successful purchase (purchase) - MUST IMPLEMENT
 */
export interface PurchaseUserProperties {
  customer_email?: string;
  user_id?: string;
  customer_first_name?: string;
  customer_last_name?: string;
  customer_phone?: string;
  customer_city?: string;
  customer_zip?: string;
  customer_address_1?: string;
  customer_address_2?: string;
  customer_country?: string;
  customer_province?: string;
}

export function trackPurchase(
  transactionId: string,
  items: Array<{
    name: string;
    id: string;
    price: number | string;
    brand?: string;
    categories?: string[];
    variant?: string;
    quantity?: number;
    coupon?: string;
  }>,
  options: {
    currency?: string;
    value?: number;
    tax?: number;
    shipping?: number;
    affiliation?: string;
    coupon?: string;
    userProperties?: PurchaseUserProperties;
  } = {}
): void {
  clearEcommerce();
  
  const ecommerceItems = items.map((item) => 
    buildItem(item.name, item.id, item.price, {
      brand: item.brand,
      categories: item.categories,
      variant: item.variant,
      quantity: item.quantity || 1,
      coupon: item.coupon
    })
  );

  // Calculate total value if not provided
  const totalValue = options.value !== undefined 
    ? options.value 
    : ecommerceItems.reduce((sum, item) => {
        return sum + (parseFloat(item.price) * parseFloat(item.quantity));
      }, 0) + (options.tax || 0) + (options.shipping || 0);

  const eventData: any = {
    event: 'purchase',
    ecommerce: {
      currency: options.currency || 'ILS',
      value: totalValue,
      transaction_id: transactionId,
      ...(options.tax !== undefined && { tax: formatPrice(options.tax) }),
      ...(options.shipping !== undefined && { shipping: formatPrice(options.shipping) }),
      ...(options.affiliation && { affiliation: options.affiliation }),
      ...(options.coupon && { coupon: options.coupon }),
      items: ecommerceItems
    }
  };

  // Add user properties if provided
  if (options.userProperties && Object.keys(options.userProperties).length > 0) {
    eventData.user_properties = options.userProperties;
  }

  if (typeof window !== 'undefined') {
    // Lightweight debug signal to verify purchase event firing
    // Includes transaction id and item count, but avoids logging full payload to keep PII minimal.
    console.info('[trackPurchase] firing purchase event', {
      transactionId,
      items: ecommerceItems.length,
      currency: eventData.ecommerce.currency,
      value: eventData.ecommerce.value,
    });
  }

  pushEvent(eventData);

  fbqTrackPurchase(
    items.map((item) => ({
      id: item.id,
      quantity: item.quantity || 1,
      item_price: toNumericPrice(item.price),
      brand: item.brand,
      item_variant: item.variant,
    })),
    { currency: eventData.ecommerce.currency, value: eventData.ecommerce.value }
  );
}

