'use client';

import { useEffect } from 'react';
import { initMarketingCookies } from '@/lib/marketingCookies';

/**
 * Initializes first-party marketing cookies (fbp/fbc/gclid) on the client.
 * Keeps payload small and runs once per mount.
 */
export default function MarketingCookies() {
  useEffect(() => {
    initMarketingCookies();
  }, []);

  return null;
}

