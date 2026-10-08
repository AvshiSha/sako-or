'use client'

/**
 * The chrome both checkout steps share (438:2725 and 438:2836 are the same
 * frame with a different form column): the two-column grid split by a black
 * hairline, the 60px "תשלום" heading, the rule under it and the SECURE CHECKOUT
 * eyebrow. The summary aside is passed in rather than built here so each step
 * can wire its own CTA.
 *
 * Below lg the columns stack and the summary follows the form, which is the
 * order a one-column checkout reads in.
 */

import type { ReactNode } from 'react'
import { SPLIT_SHELL_GRID } from '@/lib/split-shell-layout'

export interface CheckoutShellProps {
  language: 'he' | 'en'
  /** Node rather than string so CheckoutSkeleton can hand in placeholder bars
      and reuse this shell verbatim instead of reproducing it. */
  title: ReactNode
  eyebrow: ReactNode
  /** The OrderSummaryPanel for this step. */
  summary: ReactNode
  children: ReactNode
}

export default function CheckoutShell({
  language,
  title,
  eyebrow,
  summary,
  children
}: CheckoutShellProps) {
  return (
    <div className="min-h-screen bg-surface-secondary" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <div className={SPLIT_SHELL_GRID}>
        {/* The seam is drawn by SPLIT_SHELL_GRID, not by a border here — the summary
            is lg:sticky and often outruns a short form column. */}
        <section>
          <div className="px-[16px] pt-[24px] pb-[24px] lg:px-[30px] lg:pt-[30px] lg:pb-[30px]">
            <h1 className="font-ploni text-[40px] font-black leading-[40px] text-start text-text-primary lg:text-[60px] lg:leading-[50px]">
              {title}
            </h1>
          </div>

          <div className="border-t border-sako-black" />

          {/* 438:2739 — 1.17px tracking here, not the 0.72px the caption style
              uses elsewhere. The frame sets it per-instance. */}
          <div className="px-[16px] py-[20px] lg:px-[30px]">
            <p className="font-ploni text-[9px] tracking-[1.17px] text-start text-text-primary">
              {eyebrow}
            </p>
          </div>

          {children}
        </section>

        {summary}
      </div>
    </div>
  )
}
