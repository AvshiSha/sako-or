/// <reference types="next" />
/// <reference types="next/image-types/global" />

// Extend Jest's expect with @testing-library/jest-dom matchers
import '@testing-library/jest-dom'

declare global {
  interface FacebookPixel {
    (command: 'init' | 'track' | 'trackCustom', eventNameOrId: string, params?: Record<string, any>): void;
    queue?: any[];
    loaded?: boolean;
    version?: string;
    getState?: () => { pixels?: Record<string, any> };
  }

  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    fbq?: FacebookPixel;
  }
}

export {};

