'use client';

import { useEffect } from 'react';
import { FACEBOOK_PIXEL_ID, initFacebookPixel } from '@/lib/facebookPixel';

/**
 * Initializes Meta Pixel base code on client side.
 * Note: noscript fallback is handled in layout.tsx (server component)
 */
export default function FacebookPixel() {
  useEffect(() => {
    try {
      initFacebookPixel();
    } catch (error) {
      console.warn('[FacebookPixel] initialization failed', error);
    }
  }, []);

  // This component only handles initialization, no UI
  return null;
}

