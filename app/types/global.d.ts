/// <reference types="next" />
/// <reference types="next/image-types/global" />

declare global {
  interface FacebookPixel {
    (command: 'init' | 'track' | 'trackCustom', eventNameOrId: string, params?: Record<string, any>): void;
    queue?: any[];
    loaded?: boolean;
    version?: string;
  }

  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    fbq?: FacebookPixel;
  }
}

export {};

