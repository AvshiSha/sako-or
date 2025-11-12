/// <reference types="next" />
/// <reference types="next/image-types/global" />

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export {};

