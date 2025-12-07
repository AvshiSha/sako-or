/**
 * Client-side utility for sending Meta Conversions API events
 * 
 * This utility sends events to our server-side API route which handles
 * hashing and forwarding to Meta's Conversions API.
 */

/**
 * Generate a UUID v4 for event deduplication
 */
export function generateEventId(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create a session ID for use as external_id
 * This helps Meta match events even when user is not logged in
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  const STORAGE_KEY = 'meta_session_id';
  let sessionId = localStorage.getItem(STORAGE_KEY);
  
  if (!sessionId) {
    sessionId = generateEventId();
    localStorage.setItem(STORAGE_KEY, sessionId);
  }
  
  return sessionId;
}

/**
 * Check if user data is sufficient for Meta matching
 * Meta requires at least: email, phone, or external_id
 */
function hasSufficientUserData(userData?: MetaUserData): boolean {
  if (!userData) return false;
  return !!(userData.email || userData.phone || userData.externalId);
}

/**
 * User data input (non-hashed, will be hashed on server)
 */
export interface MetaUserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  zipCode?: string;
  city?: string;
  state?: string;
  country?: string;
  externalId?: string;
}

/**
 * Custom data for events
 */
export interface MetaCustomData {
  currency?: string;
  value?: number;
  content_type?: string;
  content_ids?: string[];
  content_name?: string;
  content_category?: string;
  num_items?: number;
  order_id?: string;
  [key: string]: any;
}

/**
 * Send a Meta Conversions API event
 */
export async function sendMetaEvent(
  eventName: string,
  options: {
    eventId?: string;
    eventSourceUrl?: string;
    userData?: MetaUserData;
    customData?: MetaCustomData;
    eventTime?: number;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate event ID if not provided (for deduplication with pixel)
    const eventId = options.eventId || generateEventId();

    // Get current URL if event_source_url not provided
    const eventSourceUrl = options.eventSourceUrl || 
      (typeof window !== 'undefined' ? window.location.href : '');

    const response = await fetch('/api/meta-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_name: eventName,
        event_id: eventId,
        event_source_url: eventSourceUrl,
        userData: options.userData,
        customData: options.customData,
        event_time: options.eventTime,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error(`[Meta Events] Failed to send ${eventName}:`, data.error || data);
      return { success: false, error: data.error || 'Unknown error' };
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Meta Events] ${eventName} sent successfully:`, eventId);
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Meta Events] Error sending ${eventName}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Helper functions for specific events
 */

export async function trackPurchase(
  orderId: string,
  value: number,
  currency: string = 'ILS',
  contentIds: string[],
  userData?: MetaUserData,
  eventId?: string
) {
  return sendMetaEvent('Purchase', {
    eventId,
    userData,
    customData: {
      currency,
      value,
      content_type: 'product',
      content_ids: contentIds,
      order_id: orderId,
    },
  });
}

export async function trackInitiateCheckout(
  value: number,
  currency: string = 'ILS',
  userData?: MetaUserData,
  eventId?: string
) {
  // Add session ID if no user data provided
  const finalUserData: MetaUserData = userData || {};
  if (typeof window !== 'undefined' && !hasSufficientUserData(finalUserData)) {
    finalUserData.externalId = getSessionId();
  }
  
  return sendMetaEvent('InitiateCheckout', {
    eventId,
    userData: finalUserData,
    customData: {
      currency,
      value,
    },
  });
}

export async function trackViewContent(
  contentIds: string[],
  contentType: string = 'product',
  userData?: MetaUserData,
  eventId?: string
) {
  // Meta requires at least email, phone, or external_id for matching
  // If no user data provided, use session ID as external_id
  const finalUserData: MetaUserData = userData || {};
  
  // If no user data and we're in browser, add session ID as external_id
  if (typeof window !== 'undefined' && !hasSufficientUserData(finalUserData)) {
    finalUserData.externalId = getSessionId();
  }
  
  // Only send if we have sufficient user data (email, phone, or external_id)
  if (!hasSufficientUserData(finalUserData)) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Meta Events] Skipping ViewContent - insufficient user data for matching');
    }
    return { success: false, error: 'Insufficient user data for Meta matching' };
  }
  
  return sendMetaEvent('ViewContent', {
    eventId,
    userData: finalUserData,
    customData: {
      content_type: contentType,
      content_ids: contentIds,
      currency: 'ILS', // Required by Meta
    },
  });
}

export async function trackAddToCart(
  contentIds: string[],
  value: number,
  currency: string = 'ILS',
  userData?: MetaUserData,
  eventId?: string
) {
  // Add session ID if no user data provided
  const finalUserData: MetaUserData = userData || {};
  if (typeof window !== 'undefined' && !hasSufficientUserData(finalUserData)) {
    finalUserData.externalId = getSessionId();
  }
  
  return sendMetaEvent('AddToCart', {
    eventId,
    userData: finalUserData,
    customData: {
      currency,
      value,
      content_type: 'product',
      content_ids: contentIds,
    },
  });
}

export async function trackAddToWishlist(
  contentIds: string[],
  currency: string = 'ILS',
  userData?: MetaUserData,
  eventId?: string
) {
  // Add session ID if no user data provided
  const finalUserData: MetaUserData = userData || {};
  if (typeof window !== 'undefined' && !hasSufficientUserData(finalUserData)) {
    finalUserData.externalId = getSessionId();
  }
  
  return sendMetaEvent('AddToWishlist', {
    eventId,
    userData: finalUserData,
    customData: {
      currency,
      content_type: 'product',
      content_ids: contentIds,
    },
  });
}

export async function trackContact(
  userData?: MetaUserData,
  eventId?: string
) {
  // Add session ID if no user data provided
  const finalUserData: MetaUserData = userData || {};
  if (typeof window !== 'undefined' && !hasSufficientUserData(finalUserData)) {
    finalUserData.externalId = getSessionId();
  }
  
  return sendMetaEvent('Contact', {
    eventId,
    userData: finalUserData,
    customData: {
      currency: 'ILS', // Required by Meta
    },
  });
}

export async function trackLead(
  userData?: MetaUserData,
  eventId?: string
) {
  return sendMetaEvent('Lead', {
    eventId,
    userData,
    customData: {
      currency: 'ILS', // Required by Meta
    },
  });
}

export async function trackSubscribedButtonClick(
  userData?: MetaUserData,
  eventId?: string
) {
  return sendMetaEvent('SubscribedButtonClick', {
    eventId,
    userData,
  });
}

export async function trackPageView(
  userData?: MetaUserData,
  eventId?: string
) {
  return sendMetaEvent('PageView', {
    eventId,
    userData,
  });
}

