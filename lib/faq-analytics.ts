/**
 * FAQ analytics event shapes.
 *
 * Pure by design — no imports beyond types. The exact parameter key names are
 * the whole contract with GTM, so they are asserted in a unit test, and a test
 * that had to import lib/dataLayer.ts (which pulls in facebookPixel and touches
 * window) could not run under node:test. The thin dataLayer wrappers live in
 * lib/faq-analytics-client.ts instead.
 *
 * No personal information is ever included: only the question slug, its
 * taxonomy, and the locale.
 */

import type { FaqAudience, FaqTopic } from './faq-types';

export const FAQ_VIEW_EVENT = 'faq_view';
export const FAQ_QUESTION_OPEN_EVENT = 'faq_question_open';
export const FAQ_CTA_CLICK_EVENT = 'faq_cta_click';

export type FaqAnalyticsParams = Record<string, string | number | boolean>;

/** How a question came to be open — separates deliberate opens from deep links. */
export type FaqOpenMethod = 'click' | 'keyboard' | 'anchor';

export type FaqCtaId = 'primary' | 'secondary' | 'whatsapp' | 'contact' | 'related';

export interface FaqViewContext {
  locale: 'he' | 'en';
  questionCount: number;
  audiences: readonly FaqAudience[];
}

export interface FaqQuestionOpenContext {
  slug: string;
  question: string;
  audience: FaqAudience | null;
  topic: FaqTopic | null;
  locale: 'he' | 'en';
  method: FaqOpenMethod;
}

export interface FaqCtaClickContext {
  ctaId: FaqCtaId;
  destinationUrl: string;
  locale: 'he' | 'en';
  slug?: string;
}

/** Drop empty values so GTM never receives a key with nothing behind it. */
function compact(
  params: Record<string, string | number | undefined | null>
): FaqAnalyticsParams {
  const clean: FaqAnalyticsParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    clean[key] = value;
  }
  return clean;
}

export function buildFaqViewParams(context: FaqViewContext): FaqAnalyticsParams {
  return compact({
    faq_locale: context.locale,
    faq_question_count: context.questionCount,
    faq_audiences: [...context.audiences].join(','),
  });
}

export function buildFaqQuestionOpenParams(
  context: FaqQuestionOpenContext
): FaqAnalyticsParams {
  return compact({
    question_id: context.slug,
    // Truncated: the full text adds nothing over the slug for analysis, and GA4
    // drops parameter values longer than 100 characters anyway.
    question_text: context.question.slice(0, 100),
    audience: context.audience,
    category: context.topic,
    faq_locale: context.locale,
    faq_open_method: context.method,
  });
}

export function buildFaqCtaClickParams(context: FaqCtaClickContext): FaqAnalyticsParams {
  return compact({
    faq_cta_id: context.ctaId,
    destination_url: context.destinationUrl,
    faq_locale: context.locale,
    question_id: context.slug,
  });
}
