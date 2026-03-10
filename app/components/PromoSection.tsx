'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { track } from '@vercel/analytics'
import { usePromo } from '@/app/contexts/PromoContext'

const DEFAULT_TARGET = '2026-03-09T00:00:00+02:00'

function parseTarget(targetDate?: Date | string): Date {
  if (targetDate === undefined) return new Date(DEFAULT_TARGET)
  if (targetDate instanceof Date) return targetDate
  return new Date(targetDate)
}

function getRemaining(target: Date): { h: number; m: number; s: number; totalSeconds: number } {
  const now = Date.now()
  const diff = Math.max(0, target.getTime() - now)
  const totalSeconds = Math.floor(diff / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return { h, m, s, totalSeconds }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Campaign ribbon: shown while countdown is active */
const promoMessage = {
  en: 'Due to the security situation ❤️ 7% discount on all products',
  he: 'עקב המצב משהו קטן מאיתנו 🤍 7% הנחה על כל האתר'
}

const couponLabel = {
  en: 'Code: SAKO7',
  he: 'קוד: SAKO7'
}

/** Default ribbon: shown after countdown ends (no campaign, no coupon) */
const defaultRibbonMessage = {
  en: 'Due to the security situation ❤️ 7% discount on all products | Code: SAKO7',
  he: 'עקב המצב, משהו קטן מאיתנו 🤍 7% הנחה על כל האתר | קוד: SAKO7'
}

const urgencyLabel = {
  en: 'The offer ends in',
  he: 'המבצע נגמר בעוד'
}

const segmentLabels = {
  en: { h: 'Hours', m: 'Min', s: 'Sec' },
  he: { h: 'שעות', m: 'דק׳', s: 'שנ׳' }
}

interface PromoSectionProps {
  lng: 'en' | 'he'
  targetDate?: Date | string
}

export default function PromoSection({ lng, targetDate }: PromoSectionProps) {
  const { setCountdownVisible } = usePromo()
  const targetTimestamp = useMemo(
    () => parseTarget(targetDate).getTime(),
    [targetDate === undefined ? DEFAULT_TARGET : typeof targetDate === 'string' ? targetDate : targetDate instanceof Date ? targetDate.getTime() : DEFAULT_TARGET]
  )
  const [timeLeft, setTimeLeft] = useState<{ h: number; m: number; s: number; totalSeconds: number } | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const target = new Date(targetTimestamp)
    const tick = () => {
      const r = getRemaining(target)
      setTimeLeft(r)
      if (r.totalSeconds <= 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        setCountdownVisible(false)
      }
    }
    setCountdownVisible(true)
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [targetTimestamp, setCountdownVisible])

  const campaignActive = timeLeft === null || timeLeft.totalSeconds > 0
  const showCountdown = campaignActive
  const { h = 0, m = 0, s = 0 } = timeLeft ?? {}
  const labels = segmentLabels[lng]

  return (
    <div className="relative w-full bg-[#B2A28E] py-2.5 text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 text-center">
        {campaignActive ? (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0">
            <Link
              href={`/${lng}/collection/women/shoes`}
              className="font-medium text-sm hover:underline md:text-base"
              suppressHydrationWarning
              onClick={() => track('promo_ribbon_click')}
            >
              {promoMessage[lng]}
            </Link>
            <span className="text-white/80">|</span>
            <span className="font-medium text-sm text-white/95 md:text-base">{couponLabel[lng]}</span>
          </div>
        ) : (
          <Link
            href={`/${lng}`}
            className="font-medium text-sm hover:underline md:text-base"
            suppressHydrationWarning
            onClick={() => track('promo_ribbon_click')}
          >
            {defaultRibbonMessage[lng]}
          </Link>
        )}

        {/*
        {showCountdown && (
          <>
            <div className="mt-1 w-full max-w-xs border-t border-white/25" />
            <div className="relative mt-2">
              <span
                className="absolute -top-2 left-0 right-0 text-center text-[10px] font-medium tracking-wide text-white/80 sm:text-[11px]"
                aria-hidden
              >
                {urgencyLabel[lng]}
              </span>
              <div
                dir="ltr"
                className="flex items-center justify-center gap-2 pt-2 sm:gap-2"
                role="timer"
                aria-live="polite"
                aria-label="Time remaining"
              >
                <Segment value={pad(h)} label={labels.h} />
                <Segment value={pad(m)} label={labels.m} />
                <Segment value={pad(s)} label={labels.s} />
              </div>
            </div>
          </>
        )}
        */}
      </div>
    </div>
  )
}

function Segment({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-[44px] flex-col items-center rounded bg-white/10 px-2 py-1 sm:min-w-[48px] sm:px-2.5 sm:py-1.5">
      <span
        className="text-sm font-semibold tabular-nums leading-tight text-white sm:text-base"
        suppressHydrationWarning
      >
        {value}
      </span>
      <span className="text-[9px] font-medium uppercase tracking-wider text-white/80 sm:text-[10px]">{label}</span>
    </div>
  )
}
