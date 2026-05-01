'use client'

import Link from 'next/link'
import { track } from '@vercel/analytics'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion as fmMotion } from 'framer-motion'

export type PromoItem = {
  text: { he: string; en: string }
  href: string
  icon?: React.ReactNode
  countdownEnd?: Date | string | number
}

const DEFAULT_PROMOS: PromoItem[] = [
  {
    text: {
      he: '20% הנחה על כל הסניקרס, רק הסופ"ש! | קוד: SNEAK20',
      en: '20% discount on all sneakers, only in the weekend! | code: SNEAK20',
    },
    href: '/collection/women/shoes/sneakers',
    icon: '👟',
    // Countdown until May 3, 2026 midnight (local time).
    countdownEnd: '2026-05-03T00:00:00',
  },
  // {
  //   text: {
  //     he: 'מחלקת האאוטלט – עד 70% הנחה על פריטים נבחרים',
  //     en: 'Outlet category – up to 70% discount on selected items',
  //   },
  //   href: '/collection/women/outlet',
  //   icon: '🔥',
  // },
]

interface PromoSectionProps {
  lng: 'en' | 'he'
  promos?: PromoItem[]
  rotationMs?: number
  pauseOnHover?: boolean
  expireMode?: 'remove' | 'hideCountdown'
}

const ROTATION_MS_DEFAULT = 4000
const TRANSITION_MS = 400
const RESERVED_COUNTDOWN_HEIGHT_PX = 18

// Work around occasional framer-motion typing mismatches in this codebase (see other usage sites).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const motion = fmMotion as unknown as any

function isInternalPath(href: string): boolean {
  return href.startsWith('/')
}

function buildLocalizedHref(lng: 'en' | 'he', href: string): string {
  if (!isInternalPath(href)) return href
  return `/${lng}${href === '/' ? '' : href}`
}

function parseCountdownEnd(value: PromoItem['countdownEnd']): number | null {
  if (value === undefined) return null
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : null
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatRemaining(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(clamped / 86400)
  const hours = Math.floor((clamped % 86400) / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const seconds = clamped % 60
  if (days > 0) return `${days}:${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}

export default function PromoSection({
  lng,
  promos = DEFAULT_PROMOS,
  rotationMs = ROTATION_MS_DEFAULT,
  pauseOnHover = true,
  expireMode = 'remove',
}: PromoSectionProps) {
  const [items, setItems] = useState<PromoItem[]>(() => promos.filter(Boolean))
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  // Countdown state (only for the active promo when it has countdownEnd).
  const [countdownText, setCountdownText] = useState<string>('')
  const [countdownVisible, setCountdownVisible] = useState(false)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep internal list in sync if parent passes a new array.
  useEffect(() => {
    setItems(promos.filter(Boolean))
    setActiveIndex(0)
  }, [promos])

  const activeItem = items.length > 0 ? items[Math.min(activeIndex, items.length - 1)] : null

  // Rotation interval (paused on hover/focus when enabled).
  useEffect(() => {
    if (items.length <= 1) return
    if (pauseOnHover && paused) return
    const id = setInterval(() => {
      setActiveIndex((i) => (items.length === 0 ? 0 : (i + 1) % items.length))
    }, rotationMs)
    return () => clearInterval(id)
  }, [items.length, paused, pauseOnHover, rotationMs])
  const promoMotionKey = useMemo(() => {
    if (!activeItem) return 'promo_empty'
    // Include lng so switching language doesn't reuse the same animated node.
    return `promo_${activeIndex}_${lng}`
  }, [activeIndex, activeItem, lng])

  // Countdown ticking for active promo only.
  useEffect(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    if (!activeItem) {
      setCountdownText('')
      setCountdownVisible(false)
      return
    }
    const endTs = parseCountdownEnd(activeItem.countdownEnd)
    if (!endTs) {
      setCountdownText('')
      setCountdownVisible(false)
      return
    }

    const tick = () => {
      const totalSeconds = Math.floor(Math.max(0, (endTs - Date.now()) / 1000))
      if (totalSeconds <= 0) {
        setCountdownText('')
        setCountdownVisible(false)

        if (expireMode === 'remove') {
          setItems((prev) => {
            const next = prev.filter((_, i) => i !== activeIndex)
            const nextLen = next.length
            setActiveIndex((prevIdx) => (nextLen <= 0 ? 0 : Math.min(prevIdx, nextLen - 1)))
            return next
          })
        }

        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
          countdownIntervalRef.current = null
        }
        return
      }

      setCountdownText(formatRemaining(totalSeconds))
      setCountdownVisible(true)
    }

    tick()
    countdownIntervalRef.current = setInterval(tick, 1000)
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
    }
  }, [activeItem, activeIndex, expireMode])

  // If items length shrinks, keep activeIndex in range.
  useEffect(() => {
    if (items.length === 0) {
      setActiveIndex(0)
      return
    }
    setActiveIndex((i) => Math.min(i, items.length - 1))
  }, [items.length])

  const href = useMemo(() => {
    if (!activeItem) return `/${lng}`
    return buildLocalizedHref(lng, activeItem.href)
  }, [activeItem, lng])

  const hasAnyCountdown = useMemo(() => {
    return items.some((p) => parseCountdownEnd(p.countdownEnd) !== null)
  }, [items])

  const onMouseEnter = () => {
    if (!pauseOnHover) return
    setPaused(true)
  }

  const onMouseLeave = () => {
    if (!pauseOnHover) return
    setPaused(false)
  }

  const onFocusCapture = () => {
    if (!pauseOnHover) return
    setPaused(true)
  }

  const onBlurCapture = (e: React.FocusEvent) => {
    if (!pauseOnHover) return
    const nextFocused = e.relatedTarget as HTMLElement | null
    if (nextFocused && e.currentTarget.contains(nextFocused)) return
    setPaused(false)
  }

  return (
    <div className="relative w-full bg-[#B2A28E] text-white">
      <div className="mx-auto max-w-7xl px-4">
        <Link
          href={href}
          className="mx-auto block w-full max-w-3xl py-2.5 text-center"
          suppressHydrationWarning
          onClick={() =>
            track('promo_ribbon_click', {
              href,
              index: activeIndex,
            })
          }
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onFocusCapture={onFocusCapture}
          onBlurCapture={onBlurCapture}
        >
          <div className="mx-auto flex w-full flex-col items-center justify-center">
            <div className="relative w-full max-w-[720px] overflow-hidden">
              <div className="relative flex min-h-[20px] items-center justify-center px-2 text-center">
                <AnimatePresence mode="wait" initial={false}>
                  {activeItem && (
                    <motion.div
                      key={promoMotionKey}
                      className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium md:text-base"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: TRANSITION_MS / 1000, ease: 'easeInOut' }}
                      style={{ willChange: 'transform, opacity' }}
                    >
                      <span className="opacity-95">{activeItem.icon ?? ''}</span>
                      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{activeItem.text[lng]}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {hasAnyCountdown && (
              <div
                className="mt-0.5 flex items-center justify-center text-[11px] font-medium tabular-nums text-white/90 md:text-xs"
                style={{ height: RESERVED_COUNTDOWN_HEIGHT_PX }}
                aria-live={countdownVisible ? 'polite' : 'off'}
                role={countdownVisible ? 'timer' : undefined}
              >
                <span
                  className={
                    countdownVisible ? 'opacity-100 transition-opacity duration-300' : 'opacity-0 transition-opacity duration-300'
                  }
                >
                  {countdownText}
                </span>
              </div>
            )}
          </div>
        </Link>
      </div>
    </div>
  )
}
