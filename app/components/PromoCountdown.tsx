'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePromo } from '@/app/contexts/PromoContext'

const DEFAULT_TARGET = '2026-03-09T00:00:00+02:00'

/** Height of the countdown bar in px. Ribbon is 40px; nav uses 40 + this when visible. */
export const PROMO_COUNTDOWN_BAR_HEIGHT = 56

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

const segmentLabels = {
  en: { h: 'Hours', m: 'Min', s: 'Sec' },
  he: { h: 'שעות', m: 'דק׳', s: 'שנ׳' }
}

interface PromoCountdownProps {
  targetDate?: Date | string
  lng?: 'en' | 'he'
}

export default function PromoCountdown({ targetDate, lng = 'en' }: PromoCountdownProps) {
  const { setCountdownVisible } = usePromo()
  const targetTimestamp = useMemo(
    () => parseTarget(targetDate).getTime(),
    [targetDate === undefined ? DEFAULT_TARGET : typeof targetDate === 'string' ? targetDate : targetDate instanceof Date ? targetDate.getTime() : DEFAULT_TARGET]
  )
  const [timeLeft, setTimeLeft] = useState<{ h: number; m: number; s: number; totalSeconds: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  if (timeLeft !== null && timeLeft.totalSeconds <= 0) {
    return null
  }

  const { h = 0, m = 0, s = 0 } = timeLeft ?? {}
  const labels = segmentLabels[lng]

  return (
    <div
      className="fixed left-0 right-0 top-10 z-[60] border-t border-white/20 bg-[#B2A28E] text-white"
      style={{ height: PROMO_COUNTDOWN_BAR_HEIGHT }}
      role="timer"
      aria-live="polite"
      aria-label="Time remaining"
    >
      <div
        className={`mx-auto flex h-full max-w-7xl items-center justify-center px-4 transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
      >
        <div dir="ltr" className="flex items-center justify-center gap-2 sm:gap-3">
          <Segment value={pad(h)} label={labels.h} />
          <Segment value={pad(m)} label={labels.m} />
          <Segment value={pad(s)} label={labels.s} />
        </div>
      </div>
    </div>
  )
}

function Segment({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-[52px] flex-col items-center rounded-md bg-white/10 px-2.5 py-1.5 sm:min-w-[56px] sm:px-3 sm:py-2">
      <span
        className="font-semibold tabular-nums text-base leading-tight text-white sm:text-lg"
        suppressHydrationWarning
      >
        {value}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-white/80 sm:text-[11px]">
        {label}
      </span>
    </div>
  )
}
