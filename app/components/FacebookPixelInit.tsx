'use client';

import { useEffect, useRef } from 'react';
import { initFacebookPixel } from '@/lib/facebookPixel';

/** Initializes Meta Pixel for all visitors; safe to mount without AuthProvider. */
export default function FacebookPixelInit() {
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    try {
      initFacebookPixel();
    } catch (error) {
      console.warn('[FacebookPixel] initialization failed', error);
    }
  }, []);

  return null;
}
