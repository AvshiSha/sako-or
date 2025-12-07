/**
 * Meta (Facebook) Conversions API Server-Side Implementation
 * 
 * This utility provides functions for sending server-side events to Meta's Conversions API.
 * All PII data is SHA256 hashed before sending, except client_user_agent which is sent raw.
 */

import crypto from 'crypto';

// Environment variables
const PIXEL_ID = process.env.FACEBOOK_PIXEL_ID;
const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const API_VERSION = process.env.FACEBOOK_API_VERSION || 'v20.0';
const TEST_EVENT_CODE = process.env.FACEBOOK_TEST_EVENT_CODE; // Optional, for testing

// Meta Conversions API endpoint
const CONVERSIONS_API_URL = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

/**
 * Hash a string using SHA256 and return lowercase hex
 */
function sha256Hash(value: string): string {
  if (!value) return '';
  // Normalize: trim, lowercase, remove extra spaces
  const normalized = value.trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Hash phone number - remove all non-digit characters before hashing
 */
function hashPhone(phone: string): string {
  if (!phone) return '';
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  return sha256Hash(digitsOnly);
}

/**
 * Hash user data fields according to Meta's requirements
 */
export interface UserDataInput {
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

export interface HashedUserData {
  em?: string[]; // email (hashed)
  ph?: string[]; // phone (hashed)
  fn?: string[]; // first name (hashed)
  ln?: string[]; // last name (hashed)
  zp?: string[]; // zip code (hashed)
  ct?: string[]; // city (hashed)
  st?: string[]; // state (hashed)
  country?: string[]; // country (hashed, but Meta accepts raw country codes)
  external_id?: string[]; // external ID (hashed)
  client_user_agent?: string; // NOT hashed - sent raw
}

/**
 * Hash user data for Meta Conversions API
 */
export function hashUserData(
  userData: UserDataInput,
  clientUserAgent?: string
): HashedUserData {
  const hashed: HashedUserData = {};

  if (userData.email) {
    const hashedEmail = sha256Hash(userData.email);
    if (hashedEmail) hashed.em = [hashedEmail];
  }

  if (userData.phone) {
    const hashedPhone = hashPhone(userData.phone);
    if (hashedPhone) hashed.ph = [hashedPhone];
  }

  if (userData.firstName) {
    const hashedFn = sha256Hash(userData.firstName);
    if (hashedFn) hashed.fn = [hashedFn];
  }

  if (userData.lastName) {
    const hashedLn = sha256Hash(userData.lastName);
    if (hashedLn) hashed.ln = [hashedLn];
  }

  if (userData.zipCode) {
    const hashedZip = sha256Hash(userData.zipCode);
    if (hashedZip) hashed.zp = [hashedZip];
  }

  if (userData.city) {
    const hashedCity = sha256Hash(userData.city);
    if (hashedCity) hashed.ct = [hashedCity];
  }

  if (userData.state) {
    const hashedState = sha256Hash(userData.state);
    if (hashedState) hashed.st = [hashedState];
  }

  if (userData.country) {
    // Country can be sent as raw code (ISO 3166-1 alpha-2) or hashed
    // Meta prefers raw for country, but we'll hash it to be safe
    const hashedCountry = sha256Hash(userData.country);
    if (hashedCountry) hashed.country = [hashedCountry];
  }

  if (userData.externalId) {
    const hashedExternalId = sha256Hash(userData.externalId);
    if (hashedExternalId) hashed.external_id = [hashedExternalId];
  }

  // client_user_agent must NOT be hashed - send raw
  if (clientUserAgent) {
    hashed.client_user_agent = clientUserAgent;
  }

  return hashed;
}

/**
 * Custom data for Meta Conversions API events
 */
export interface CustomData {
  currency?: string;
  value?: number;
  content_type?: string;
  content_ids?: string[];
  content_name?: string;
  content_category?: string;
  num_items?: number;
  order_id?: string;
  [key: string]: any; // Allow additional custom fields
}

/**
 * Meta Conversions API event payload
 */
export interface MetaEvent {
  event_name: string;
  event_time: number; // Unix timestamp in seconds
  event_source_url: string;
  action_source: 'website' | 'email' | 'app' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'other';
  event_id?: string; // For deduplication with pixel
  user_data: HashedUserData;
  custom_data?: CustomData;
  // Note: test_event_code is NOT part of the event object - it's a top-level payload parameter
}

/**
 * Send event to Meta Conversions API
 */
export async function sendMetaEvent(
  event: MetaEvent
): Promise<{ success: boolean; error?: string; response?: any }> {
  // Validate required environment variables
  if (!PIXEL_ID) {
    const error = 'FACEBOOK_PIXEL_ID environment variable is not set';
    console.error('[Meta Conversions API]', error);
    return { success: false, error };
  }

  if (!ACCESS_TOKEN) {
    const error = 'FACEBOOK_ACCESS_TOKEN environment variable is not set';
    console.error('[Meta Conversions API]', error);
    return { success: false, error };
  }

  // Validate user data has at least one identifier
  const hasEmail = !!(event.user_data.em && event.user_data.em.length > 0);
  const hasPhone = !!(event.user_data.ph && event.user_data.ph.length > 0);
  const hasExternalId = !!(event.user_data.external_id && event.user_data.external_id.length > 0);
  
  if (!hasEmail && !hasPhone && !hasExternalId) {
    const error = 'User data must include at least one of: email, phone, or external_id';
    console.error('[Meta Conversions API]', error, {
      event_name: event.event_name,
      user_data_keys: Object.keys(event.user_data),
    });
    return { success: false, error };
  }

  // Build payload
  const payload: {
    data: MetaEvent[];
    access_token: string;
    test_event_code?: string;
  } = {
    data: [event],
    access_token: ACCESS_TOKEN,
  };

  // Add test event code at payload level (not in event object)
  if (TEST_EVENT_CODE) {
    payload.test_event_code = TEST_EVENT_CODE;
  }

  try {
    const response = await fetch(CONVERSIONS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const error = `Meta API error: ${response.status} - ${JSON.stringify(responseData)}`;
      console.error('[Meta Conversions API]', error);
      return { success: false, error, response: responseData };
    }

    // Log success in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Meta Conversions API] Event sent successfully:', {
        event_name: event.event_name,
        event_id: event.event_id,
        response: responseData,
      });
    }

    return { success: true, response: responseData };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Meta Conversions API] Network error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Helper function to get current Unix timestamp in seconds
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Helper function to generate a unique event ID (UUID v4)
 * This should match the event_id used in the browser pixel
 */
export function generateEventId(): string {
  // Simple UUID v4 generator (for server-side use)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

