'use client'

import { cn } from '@/lib/utils'

import CheckoutShell from './CheckoutShell'
import {
  CHECKOUT_CELL,
  CHECKOUT_CTA_H,
  CHECKOUT_INPUT_H,
  CHECKOUT_LABEL_H,
  CHECKOUT_ROW_GRID,
  CHECKOUT_SKELETON_FIELDS,
  CHECKOUT_TITLE_H,
} from './checkoutChrome'

/**
 * The checkout fallback.
 *
 * It replaces a bare `<div className="min-h-screen bg-surface-secondary" />`,
 * which reserved the right ground and said nothing — on the one page where a
 * shopper has already decided to buy and is waiting to be told the form is
 * coming. The wait is not incidental: `useCartPricing` calls `useSearchParams()`
 * to read `?coupon=`, which makes Next bail this whole boundary out of server
 * rendering (`BAILOUT_TO_CLIENT_SIDE_RENDERING` is in the served HTML), so the
 * fallback is what ships and the form only exists after hydration. Measured at
 * 4x CPU: 1794ms of blank box on desktop, 9597ms on mobile. This is not a rare
 * race — it is every load.
 *
 * Built on the real `CheckoutShell` rather than a copy of it, so the two-column
 * grid, the seam, the heading band and the eyebrow rule are the same elements the
 * loaded page uses. Only the contents are placeholders. The form column's own
 * measurements come from `checkoutChrome`, which `CheckoutClient` also reads.
 *
 * Deliberately touches no checkout logic. A Suspense fallback renders only while
 * the boundary is pending, so validation, autofill, cart state, pricing and the
 * Cardcom handoff are all downstream of this file and cannot be affected by it.
 */

function Line({ className }: { className?: string }) {
  return <div className={cn('sako-skeleton sako-skeleton-muted', className)} aria-hidden />
}

/** One labelled field: caption above, control below, same cell padding as the form. */
function FieldSkeleton() {
  return (
    <div className={CHECKOUT_CELL}>
      <Line className={cn('mb-[6px] w-[38%]', CHECKOUT_LABEL_H)} />
      <div className={cn('sako-skeleton w-full', CHECKOUT_INPUT_H)} aria-hidden />
    </div>
  )
}

/**
 * The standing panel. Mirrors OrderSummaryPanel's order — heading, coupon
 * control, the ruled rows, the total, the CTA — at its own paddings.
 */
function SummarySkeleton() {
  return (
    <aside className="lg:sticky lg:top-0">
      <div className="flex flex-col gap-[20px] px-[16px] pt-[30px] pb-[30px] lg:px-[30px]">
        <div className={cn('sako-skeleton w-[52%]', CHECKOUT_TITLE_H)} aria-hidden />

        {/* Coupon control. */}
        <div className="flex flex-col gap-[10px]">
          <Line className="h-[16px] w-[34%]" />
          <div className={cn('sako-skeleton w-full', CHECKOUT_CTA_H)} aria-hidden />
        </div>

        {/* Subtotal / delivery / total, each a ruled row. */}
        <div className="flex flex-col gap-[14px]">
          <div className="h-px w-full shrink-0 bg-sako-ink-900/20" aria-hidden />
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`sum-row-${index}`} className="flex items-center justify-between">
              <Line className="h-[14px] w-[30%]" />
              <Line className="h-[14px] w-[22%]" />
            </div>
          ))}
          <div className="h-px w-full shrink-0 bg-sako-ink-900/20" aria-hidden />
          <div className="flex items-center justify-between">
            <Line className="h-[18px] w-[26%]" />
            <Line className="h-[18px] w-[28%]" />
          </div>
        </div>

        {/* Pay CTA. */}
        <div className={cn('sako-skeleton w-full', CHECKOUT_CTA_H)} aria-hidden />
      </div>
    </aside>
  )
}

export default function CheckoutSkeleton({
  language,
  label = 'Loading checkout',
}: {
  language: 'he' | 'en'
  label?: string
}) {
  return (
    // role="status" so the wait is announced rather than silent. The pieces inside
    // are aria-hidden, so a screen reader gets the label and not a wall of boxes.
    <div role="status" aria-busy="true" aria-label={label}>
      <CheckoutShell
        language={language}
        title={<span className={cn('sako-skeleton block w-[42%]', CHECKOUT_TITLE_H)} aria-hidden />}
        eyebrow={<span className="sako-skeleton sako-skeleton-muted block h-[9px] w-[132px]" aria-hidden />}
        summary={<SummarySkeleton />}
      >
        <div className="px-[16px] pb-[40px] lg:px-[30px]">
          {/* Delivery method heading, then the two method rows. */}
          <Line className="h-[24px] w-[44%]" />
          <div className="mt-[10px] flex flex-col gap-[10px]">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={`method-${index}`} className="flex items-center gap-[10px]">
                <div className="sako-skeleton size-[18px] shrink-0" aria-hidden />
                <Line className="h-[14px] w-[36%]" />
              </div>
            ))}
          </div>

          {/* The form itself, two-up from sm. */}
          <div className="mt-[30px] max-w-[681px]">
            <div className={CHECKOUT_ROW_GRID}>
              {Array.from({ length: CHECKOUT_SKELETON_FIELDS }).map((_, index) => (
                <FieldSkeleton key={`field-${index}`} />
              ))}
            </div>

            {/* Terms row. */}
            <div className="mt-[20px] flex items-start gap-[10px]">
              <div className="sako-skeleton mt-[2px] size-[18px] shrink-0" aria-hidden />
              <Line className="h-[14px] w-[64%]" />
            </div>
          </div>
        </div>
      </CheckoutShell>
    </div>
  )
}
