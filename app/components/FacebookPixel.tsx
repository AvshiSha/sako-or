'use client';

import { useEffect, useRef } from 'react';
import { FACEBOOK_PIXEL_ID, initFacebookPixel } from '@/lib/facebookPixel';

/**
 * Initializes Meta Pixel base code on client side.
 * Note: noscript fallback is handled in layout.tsx (server component)
 * 
 * Uses a ref to prevent duplicate initialization even in React Strict Mode.
 * In Israel, no consent is required - we just inform users about cookies.
 */
export default function FacebookPixel() {
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Prevent duplicate initialization in React Strict Mode
    if (hasInitialized.current) return;

    // Mark as initialized attempt immediately to avoid retries on errors
    hasInitialized.current = true;

    try {
      initFacebookPixel();
    } catch (error) {
      console.warn('[FacebookPixel] initialization failed', error);
    }
  }, []);

  // This component only handles initialization, no UI
  return null;
}

