/**
 * Browser-side FAQ analytics wrappers.
 *
 * Separated from lib/faq-analytics.ts so the param builders stay importable
 * from node:test — this file reaches lib/dataLayer.ts, which pulls in the Meta
 * Pixel helpers and touches `window`.
 *
 * No consent check here, deliberately. window.dataLayer is initialised at
 * import and GTM is only injected after the cookie notice is acknowledged
 * (DeferredAnalytics -> loadAnalytics); events pushed before that queue in the
 * array and GTM replays them on load. That is how every other event on this
 * site already behaves, and adding a gate here would silently drop FAQ events
 * while trackViewItem et al. kept firing.
 */

import { trackEvent } from './dataLayer';
import {
  FAQ_CTA_CLICK_EVENT,
  FAQ_QUESTION_OPEN_EVENT,
  FAQ_VIEW_EVENT,
  buildFaqCtaClickParams,
  buildFaqQuestionOpenParams,
  buildFaqViewParams,
  type FaqCtaClickContext,
  type FaqQuestionOpenContext,
  type FaqViewContext,
} from './faq-analytics';

export function trackFaqView(context: FaqViewContext): void {
  trackEvent(FAQ_VIEW_EVENT, buildFaqViewParams(context));
}

export function trackFaqQuestionOpen(context: FaqQuestionOpenContext): void {
  trackEvent(FAQ_QUESTION_OPEN_EVENT, buildFaqQuestionOpenParams(context));
}

export function trackFaqCtaClick(context: FaqCtaClickContext): void {
  trackEvent(FAQ_CTA_CLICK_EVENT, buildFaqCtaClickParams(context));
}
